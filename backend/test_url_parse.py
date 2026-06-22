from urllib.parse import urlparse, unquote

urls = [
    "postgresql://postgres:gunateja99@aws-1-us-east-1.pooler.supabase.com:6543/postgres",
    "postgresql://postgres.tkmhawkynnveqckwllyl:gunateja99@aws-1-us-east-1.pooler.supabase.com:6543/postgres"
]

for url in urls:
    try:
        parsed = urlparse(url)
        print("URL:", url)
        print("  - scheme:", parsed.scheme)
        print("  - netloc:", parsed.netloc)
        print("  - path:", parsed.path)
        print("  - username:", parsed.username)
        print("  - password:", parsed.password)
        print("  - hostname:", parsed.hostname)
        print("  - port:", parsed.port)
    except Exception as e:
        print("Error parsing:", e)
