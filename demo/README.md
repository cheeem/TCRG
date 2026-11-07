Create certificates: 

mkdir -p certs

openssl req -x509 -newkey ec \
  -pkeyopt ec_paramgen_curve:prime256v1 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -days 14 -nodes \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"