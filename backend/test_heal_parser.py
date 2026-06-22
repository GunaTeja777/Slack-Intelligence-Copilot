import os
import urllib.parse

def parse_and_heal_db_url(db_url: str, postgres_pass: str = None, pg_host: str = None) -> str:
    db_url = db_url.strip("'\"\r\n \t")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    # 1. Extract project ref if available
    project_ref = None
    if pg_host and ".supabase.co" in pg_host:
        project_ref = pg_host.split(".supabase.co")[0]
        if "." in project_ref:
            project_ref = project_ref.split(".")[-1]

    # 2. Parse and reconstruct URL
    if "://" in db_url:
        scheme, rest = db_url.split("://", 1)
        if "@" in rest:
            userinfo, hostinfo = rest.rsplit("@", 1)
            
            username = userinfo
            password = None
            if ":" in userinfo:
                username, password = userinfo.split(":", 1)

            # Auto-encode password if we have the raw password from env
            if postgres_pass:
                password = urllib.parse.quote(postgres_pass, safe='')
            elif password:
                # If we don't have raw password, ensure the existing one is properly quoted
                # (if it contains special chars but wasn't encoded, this is a fallback)
                password = urllib.parse.quote(urllib.parse.unquote(password), safe='')

            # Auto-inject project ref for Supabase connection poolers
            if "pooler.supabase.com" in hostinfo and project_ref:
                if "." not in username:
                    username = f"{username}.{project_ref}"

            # Reconstruct the healed URL
            if password:
                db_url = f"{scheme}://{username}:{password}@{hostinfo}"
            else:
                db_url = f"{scheme}://{username}@{hostinfo}"
                
    return db_url

# Test cases
test_cases = [
    {
        "url": "postgresql://postgres:gunateja99@aws-1-us-east-1.pooler.supabase.com:6543/postgres",
        "pass": "gunateja99@",
        "host": "db.tkmhawkynnveqckwllyl.supabase.co"
    },
    {
        "url": "postgresql://postgres.tkmhawkynnveqckwllyl:gunateja99%40@aws-1-us-east-1.pooler.supabase.com:6543/postgres",
        "pass": "gunateja99@",
        "host": "db.tkmhawkynnveqckwllyl.supabase.co"
    }
]

for idx, tc in enumerate(test_cases):
    healed = parse_and_heal_db_url(tc["url"], tc["pass"], tc["host"])
    print(f"Test {idx+1}:")
    print(f"  Original: {tc['url']}")
    print(f"  Healed:   {healed}")
