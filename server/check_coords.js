import { parseKmzBuffer } from './typhoonService.js';

async function check() {
  const kmzUrl = 'https://www.metoc.navy.mil/jtwc/products/wp2426.kmz';
  const res = await fetch(kmzUrl);
  const buf = Buffer.from(await res.arrayBuffer());
  const geojson = parseKmzBuffer(buf, 'DUJUAN');
  
  geojson.features.forEach((f, idx) => {
    if (f.geometry.type === 'LineString') {
      console.log('LINE [' + idx + '] type=' + f.properties.feature_type + ' len=' + f.geometry.coordinates.length + ' start=' + JSON.stringify(f.geometry.coordinates[0]) + ' end=' + JSON.stringify(f.geometry.coordinates[f.geometry.coordinates.length-1]));
    } else if (f.geometry.type === 'Point' && f.properties.feature_type === 'forecast_point') {
      console.log('FC POINT [' + idx + '] tau=' + f.properties.tau_h + ' coords=' + JSON.stringify(f.geometry.coordinates) + ' wind=' + f.properties.wind_kmh);
    }
  });
}
check();
