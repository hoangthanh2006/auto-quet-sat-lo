import sys
import os
import json
import tempfile
import traceback
import time
import re
import unicodedata
from http.server import HTTPServer, BaseHTTPRequestHandler

# Import PyMuPDF, PIL, OpenCV
import fitz
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageOps

PORT = 3003
EASY_READER = None
PADDLE_OCR = None
HAS_EASYOCR = False
HAS_PADDLEOCR = False

def init_ocr():
    global EASY_READER, PADDLE_OCR, HAS_EASYOCR, HAS_PADDLEOCR

    print(f"[{time.strftime('%H:%M:%S')}] Initializing persistent OCR Engines in memory...")

    # 1. EasyOCR
    try:
        import easyocr
        EASY_READER = easyocr.Reader(['vi', 'en'], gpu=False)
        HAS_EASYOCR = True
        print(f"[{time.strftime('%H:%M:%S')}] EasyOCR Engine ready (Việt - Anh)!")
    except Exception as e:
        HAS_EASYOCR = False
        print(f"[{time.strftime('%H:%M:%S')}] EasyOCR init warning: {e}")

    # 2. PaddleOCR 2.8
    try:
        from paddleocr import PaddleOCR
        PADDLE_OCR = PaddleOCR(use_angle_cls=True, lang='vi', show_log=False)
        HAS_PADDLEOCR = True
        print(f"[{time.strftime('%H:%M:%S')}] PaddleOCR 2.8 Engine ready (Việt - Anh)!")
    except Exception as e:
        HAS_PADDLEOCR = False
        print(f"[{time.strftime('%H:%M:%S')}] PaddleOCR init warning: {e}")

def remove_notebook_lines(img_path):
    """
    Enhance handwritten pen ink strokes and suppress notebook grid background lines
    """
    img = cv2.imread(img_path)
    if img is None:
        return img_path, False

    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        # Detect horizontal paper lines
        h_size = max(20, img.shape[1] // 35)
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (h_size, 1))
        thresh = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6)

        detected_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel, iterations=1)
        kernel_dilate = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        detected_lines = cv2.dilate(detected_lines, kernel_dilate, iterations=1)

        # Subtract lines softly
        text_only = cv2.subtract(thresh, detected_lines)
        cleaned = cv2.bitwise_not(text_only)

        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".png")
        os.close(tmp_fd)
        cv2.imwrite(tmp_path, cleaned)
        return tmp_path, True
    except Exception as e:
        print(f"Notebook line removal error: {e}")
        return img_path, False

def preprocess_image_for_ocr(pil_img):
    """
    Enhance image contrast for printed text
    """
    try:
        gray = pil_img.convert('L')
        enhancer = ImageEnhance.Contrast(gray)
        enhanced = enhancer.enhance(1.8)
        autocontrast = ImageOps.autocontrast(enhanced, cutoff=1)
        return autocontrast
    except Exception:
        return pil_img

def resize_and_preprocess(img_path, is_handwritten=False, max_dim=1800):
    """Resize image, remove paper lines, and apply contrast enhancement"""
    if is_handwritten:
        # First remove notebook paper lines
        proc_path, is_temp = remove_notebook_lines(img_path)
        return proc_path, is_temp

    try:
        with Image.open(img_path) as img:
            w, h = img.size
            if max(w, h) > max_dim:
                scale = max_dim / float(max(w, h))
                new_w, new_h = int(w * scale), int(h * scale)
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

            processed = preprocess_image_for_ocr(img)
            tmp_fd, tmp_path = tempfile.mkstemp(suffix=".png")
            os.close(tmp_fd)
            processed.save(tmp_path, format="PNG", optimize=True)
            return tmp_path, True
    except Exception as e:
        print(f"Preprocess image error: {e}")
        return img_path, False

def clean_vietnamese_text(text):
    """Normalize Vietnamese Unicode to NFC and clean control chars"""
    if not text:
        return ""
    text = unicodedata.normalize('NFC', text)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    return text.strip()

def is_garbled_font_text(text):
    """Detect if embedded PDF font text is garbled (legacy VNTime/TCVN3 or unmapped CID fonts)"""
    if not text or len(text.strip()) < 10:
        return False
    garbled_patterns = len(re.findall(r'[a-z][A-Z]|[A-Z]{2,}[a-z][A-Z]|;\s*_[A-Z]|_[a-z]+_[a-z]+', text))
    clean_words = len(text.split())
    if clean_words > 0 and (garbled_patterns / clean_words) > 0.15:
        return True
    return False

def group_ocr_results_into_lines(ocr_results):
    """Group bounding boxes horizontally into natural reading lines using vertical overlap matching"""
    if not ocr_results:
        return [], ""

    items = []
    for item_data in ocr_results:
        if len(item_data) >= 2:
            bbox = item_data[0]
            text = item_data[1]
            prob = item_data[2] if len(item_data) > 2 else 1.0

            if isinstance(text, tuple) or isinstance(text, list):
                prob = text[1]
                text = text[0]

            clean_t = clean_vietnamese_text(str(text))
            if clean_t:
                y_min = min(pt[1] for pt in bbox)
                y_max = max(pt[1] for pt in bbox)
                x_min = min(pt[0] for pt in bbox)
                x_max = max(pt[0] for pt in bbox)
                height = max(10, y_max - y_min)
                items.append({
                    "text": clean_t,
                    "confidence": round(float(prob), 4),
                    "y_min": y_min,
                    "y_max": y_max,
                    "x_min": x_min,
                    "x_max": x_max,
                    "height": height
                })

    if not items:
        return [], ""

    # Sort items vertically top-to-bottom
    items.sort(key=lambda item: (item["y_min"], item["x_min"]))

    lines_clustered = []

    for item in items:
        matched_line = None
        for line in lines_clustered:
            # Calculate vertical overlap with line bounds
            line_y_min = min(it["y_min"] for it in line)
            line_y_max = max(it["y_max"] for it in line)

            overlap = max(0, min(line_y_max, item["y_max"]) - max(line_y_min, item["y_min"]))
            min_h = min(line_y_max - line_y_min, item["height"])

            # If vertical overlap is >= 35% of item height, it belongs to this line
            if min_h > 0 and (overlap / float(min_h)) >= 0.35:
                matched_line = line
                break

        if matched_line is not None:
            matched_line.append(item)
        else:
            lines_clustered.append([item])

    # Re-sort lines vertically top-to-bottom
    lines_clustered.sort(key=lambda line: min(it["y_min"] for it in line))

    final_lines = []
    full_text_lines = []

    for line_items in lines_clustered:
        # Sort items within line from left to right
        line_items.sort(key=lambda item: item["x_min"])
        line_text = " ".join(it["text"] for it in line_items)
        avg_conf = round(sum(it["confidence"] for it in line_items) / len(line_items), 4)

        final_lines.append({
            "text": line_text,
            "confidence": avg_conf
        })
        full_text_lines.append(line_text)

    return final_lines, "\n".join(full_text_lines)

def process_image_fast(image_path, engine='auto', is_handwritten=False):
    # Determine preferred engine
    use_paddle = (engine == 'paddleocr' or (engine == 'auto' and HAS_PADDLEOCR)) and HAS_PADDLEOCR
    proc_path, is_temp = resize_and_preprocess(image_path, is_handwritten=is_handwritten, max_dim=1800)

    try:
        if use_paddle and PADDLE_OCR:
            res = PADDLE_OCR.ocr(proc_path, cls=True)
            ocr_items = res[0] if res and len(res) > 0 else []
            lines, full_text = group_ocr_results_into_lines(ocr_items)
            method = "paddleocr"
        elif HAS_EASYOCR and EASY_READER:
            results = EASY_READER.readtext(proc_path, paragraph=False)
            lines, full_text = group_ocr_results_into_lines(results)
            method = "easyocr"
        else:
            return {
                "text": "",
                "confidence": 0.0,
                "lines": [],
                "error": "Không có động cơ OCR nào sẵn sàng"
            }

        confidences = [l["confidence"] for l in lines]
        avg_conf = round(sum(confidences) / len(confidences), 4) if confidences else 0.0

        return {
            "text": full_text,
            "confidence": avg_conf,
            "lines": lines,
            "method": method
        }
    finally:
        if is_temp and os.path.exists(proc_path):
            try:
                os.remove(proc_path)
            except Exception:
                pass

def process_pdf_fast(pdf_path, force_ocr=False, engine='auto', is_handwritten=False):
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    pages_output = []
    full_text_all_pages = []

    for page_num in range(total_pages):
        page = doc[page_num]
        embedded_text = clean_vietnamese_text(page.get_text("text"))
        garbled = is_garbled_font_text(embedded_text)

        if embedded_text and not garbled and not force_ocr and not is_handwritten:
            lines = [{"text": clean_vietnamese_text(line), "confidence": 1.0} for line in embedded_text.splitlines() if line.strip()]
            pages_output.append({
                "page": page_num + 1,
                "text": embedded_text,
                "confidence": 1.0,
                "lines": lines,
                "method": "embedded"
            })
            full_text_all_pages.append(embedded_text)
        else:
            pix = page.get_pixmap(dpi=150)
            tmp_fd, tmp_img_path = tempfile.mkstemp(suffix=".png")
            os.close(tmp_fd)
            pix.save(tmp_img_path)

            try:
                ocr_res = process_image_fast(tmp_img_path, engine=engine, is_handwritten=is_handwritten)
                ocr_res["page"] = page_num + 1
                pages_output.append(ocr_res)
                if ocr_res["text"]:
                    full_text_all_pages.append(ocr_res["text"])
            finally:
                if os.path.exists(tmp_img_path):
                    try:
                        os.remove(tmp_img_path)
                    except Exception:
                        pass

    doc.close()
    return {
        "totalPages": total_pages,
        "fullText": "\n\n".join(full_text_all_pages),
        "pages": pages_output
    }

class OCRHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_GET(self):
        if self.path == "/status" or self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            payload = {
                "success": True,
                "hasEasyOcr": HAS_EASYOCR,
                "hasPaddleOcr": HAS_PADDLEOCR,
                "easyOcrLoaded": EASY_READER is not None,
                "paddleOcrLoaded": PADDLE_OCR is not None,
                "ready": HAS_EASYOCR or HAS_PADDLEOCR,
                "message": "Persistent OCR Daemon is running"
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/scan":
            start_time = time.time()
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length)

            try:
                req_json = json.loads(post_data.decode("utf-8"))
                file_path = req_json.get("filePath")
                force_ocr = req_json.get("forceOcr", False)
                engine = req_json.get("engine", "auto")
                is_handwritten = req_json.get("isHandwritten", False)

                if not file_path or not os.path.exists(file_path):
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"success": False, "error": f"File not found: {file_path}"}).encode("utf-8"))
                    return

                ext = os.path.splitext(file_path)[1].lower()

                if ext == ".pdf":
                    res = process_pdf_fast(file_path, force_ocr=force_ocr, engine=engine, is_handwritten=is_handwritten)
                    res["success"] = True
                    res["fileType"] = "pdf"
                    res["fileName"] = os.path.basename(file_path)
                    res["procTimeSec"] = round(time.time() - start_time, 2)

                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))

                elif ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"]:
                    res = process_image_fast(file_path, engine=engine, is_handwritten=is_handwritten)
                    output = {
                        "success": True,
                        "fileType": "image",
                        "fileName": os.path.basename(file_path),
                        "totalPages": 1,
                        "fullText": res["text"],
                        "procTimeSec": round(time.time() - start_time, 2),
                        "pages": [{
                            "page": 1,
                            "text": res["text"],
                            "confidence": res["confidence"],
                            "lines": res["lines"],
                            "method": res.get("method", "easyocr")
                        }]
                    }
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(output, ensure_ascii=False).encode("utf-8"))
                else:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"success": False, "error": f"Unsupported format: {ext}"}).encode("utf-8"))

            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                err_payload = {"success": False, "error": str(e), "traceback": traceback.format_exc()}
                self.wfile.write(json.dumps(err_payload, ensure_ascii=False).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

def run_server():
    init_ocr()
    server_address = ("127.0.0.1", PORT)
    httpd = HTTPServer(server_address, OCRHandler)
    print(f"[{time.strftime('%H:%M:%S')}] Persistent OCR Daemon listening on http://127.0.0.1:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down OCR Daemon.")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
