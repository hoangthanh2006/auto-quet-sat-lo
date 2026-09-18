import sys
import os
import json
import argparse
import tempfile
import traceback

def process_image(image_path, reader):
    try:
        results = reader.readtext(image_path)
        lines = []
        full_text_list = []
        confidences = []

        for bbox, text, prob in results:
            clean_text = str(text).trim() if hasattr(text, 'trim') else str(text).strip()
            if clean_text:
                lines.append({
                    "text": clean_text,
                    "confidence": round(float(prob), 4)
                })
                full_text_list.append(clean_text)
                confidences.append(float(prob))

        avg_conf = round(sum(confidences) / len(confidences), 4) if confidences else 0.0
        return {
            "text": "\n".join(full_text_list),
            "confidence": avg_conf,
            "lines": lines
        }
    except Exception as e:
        return {
            "text": "",
            "confidence": 0.0,
            "lines": [],
            "error": str(e)
        }

def process_pdf(pdf_path, reader, force_ocr=False):
    import fitz  # PyMuPDF
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    pages_output = []
    full_text_all_pages = []

    for page_num in range(total_pages):
        page = doc[page_num]
        embedded_text = page.get_text("text").strip()

        # If PDF has embedded text and force_ocr is False, use embedded text
        if embedded_text and not force_ocr:
            lines = [{"text": line.strip(), "confidence": 1.0} for line in embedded_text.splitlines() if line.strip()]
            pages_output.append({
                "page": page_num + 1,
                "text": embedded_text,
                "confidence": 1.0,
                "lines": lines,
                "method": "embedded"
            })
            full_text_all_pages.append(embedded_text)
        else:
            # Render page to image for OCR scanning
            pix = page.get_pixmap(dpi=150)
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_img:
                tmp_img_path = tmp_img.name
                pix.save(tmp_img_path)

            try:
                ocr_res = process_image(tmp_img_path, reader)
                ocr_res["page"] = page_num + 1
                ocr_res["method"] = "easyocr"
                pages_output.append(ocr_res)
                if ocr_res["text"]:
                    full_text_all_pages.append(ocr_res["text"])
            finally:
                if os.path.exists(tmp_img_path):
                    os.remove(tmp_img_path)

    doc.close()
    return {
        "totalPages": total_pages,
        "fullText": "\n\n--- Trang %d ---\n\n".join(full_text_all_pages) if len(full_text_all_pages) > 1 else ("\n".join(full_text_all_pages)),
        "pages": pages_output
    }

def main():
    parser = argparse.ArgumentParser(description="Image & PDF OCR Engine")
    parser.add_argument("file_path", help="Path to image or PDF file")
    parser.add_argument("--langs", default="vi,en", help="Comma-separated language codes (default: vi,en)")
    parser.add_argument("--force-ocr", action="store_true", help="Force EasyOCR scanning even for PDFs with embedded text")
    args = parser.parse_args()

    file_path = args.file_path
    if not os.path.exists(file_path):
        print(json.dumps({"success": False, "error": f"File not found: {file_path}"}))
        sys.exit(1)

    ext = os.path.splitext(file_path)[1].lower()
    lang_list = [l.strip() for l in args.langs.split(",") if l.strip()]

    try:
        reader = None
        has_easyocr = False
        try:
            import easyocr
            reader = easyocr.Reader(lang_list, gpu=False)
            has_easyocr = True
        except ImportError:
            has_easyocr = False

        if ext == ".pdf":
            import fitz
            doc = fitz.open(file_path)
            total_pages = len(doc)
            pages_output = []
            full_text_all_pages = []

            for page_num in range(total_pages):
                page = doc[page_num]
                embedded_text = page.get_text("text").strip()

                if embedded_text or not has_easyocr or not reader:
                    lines = [{"text": line.strip(), "confidence": 1.0} for line in embedded_text.splitlines() if line.strip()]
                    pages_output.append({
                        "page": page_num + 1,
                        "text": embedded_text,
                        "confidence": 1.0,
                        "lines": lines,
                        "method": "embedded"
                    })
                    if embedded_text:
                        full_text_all_pages.append(embedded_text)
                else:
                    pix = page.get_pixmap(dpi=150)
                    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_img:
                        tmp_img_path = tmp_img.name
                        pix.save(tmp_img_path)
                    try:
                        ocr_res = process_image(tmp_img_path, reader)
                        ocr_res["page"] = page_num + 1
                        ocr_res["method"] = "easyocr"
                        pages_output.append(ocr_res)
                        if ocr_res["text"]:
                            full_text_all_pages.append(ocr_res["text"])
                    finally:
                        if os.path.exists(tmp_img_path):
                            os.remove(tmp_img_path)

            doc.close()
            output = {
                "success": True,
                "fileType": "pdf",
                "fileName": os.path.basename(file_path),
                "totalPages": total_pages,
                "fullText": "\n\n".join(full_text_all_pages),
                "pages": pages_output
            }
            print(json.dumps(output, ensure_ascii=False))

        elif ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"]:
            if not has_easyocr or not reader:
                print(json.dumps({
                    "success": False,
                    "error": "Mô hình EasyOCR đang khởi tạo hoặc cài đặt gói thư viện. Vui lòng thử lại sau 1-2 phút."
                }))
                sys.exit(1)

            res = process_image(file_path, reader)
            output = {
                "success": True,
                "fileType": "image",
                "fileName": os.path.basename(file_path),
                "totalPages": 1,
                "fullText": res["text"],
                "pages": [{
                    "page": 1,
                    "text": res["text"],
                    "confidence": res["confidence"],
                    "lines": res["lines"],
                    "method": "easyocr"
                }]
            }
            print(json.dumps(output, ensure_ascii=False))
        else:
            print(json.dumps({"success": False, "error": f"Định dạng tệp không được hỗ trợ: {ext}"}))
            sys.exit(1)

    except Exception as e:
        error_payload = {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_payload, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()
