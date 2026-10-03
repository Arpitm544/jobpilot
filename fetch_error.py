import urllib.request
try:
    urllib.request.urlopen('http://127.0.0.1:8000/api/v1/jobs?limit=50').read()
except Exception as e:
    print(e.read().decode('utf-8', errors='ignore'))
