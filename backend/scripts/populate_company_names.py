import os
import sys
import hashlib
from neo4j import GraphDatabase

# Company Name Generator Catalogs
COMPANY_PREFIXES = [
    "Apex", "Vortex", "Blackwood", "Shadow Peak", "Nova Phoenix", "Omni Matrix", "Ironclad",
    "DarkSky", "Cayman Star", "Panama Merchant", "Helios", "Silverline", "Titan Meridian",
    "Zenith", "BlueStar", "Orion", "Cobalt Nexus", "Starlight", "Aero Dynamic", "Pacific Maritime",
    "Beacon Star", "Valiant", "Monarch", "Summit Global", "Atlas", "Aurora", "Riverside",
    "Greenleaf", "Horizon", "Beacon", "Skyline", "Pinnacle", "Golden Oak", "Crestview",
    "Sterling", "Redwood", "Quantum Core", "Solaria", "Nexus Prime", "Evergreen", "Harbor Point",
    "Trident", "Castlestone", "Aegis", "Solstice", "Vanguard", "Frontier", "Celerity", "Polaris",
    "Astra", "Borealis", "Crestline", "Equinox", "Highland", "Ironwood", "Keystone", "Lighthouse",
    "Mariner", "Northstar", "Oakridge", "Pioneer", "Redstone", "Seagate", "Timberland", "Zephyr"
]

COMPANY_MIDDLES = [
    "Global", "Capital", "Logistics", "Holdings", "Ventures", "Trading", "Commercial", "Partners",
    "Financial", "Enterprises", "Industries", "Technologies", "Energy", "Maritime", "Aerospace",
    "Biotech", "Real Estate", "Commodities", "Securities", "Investments", "International", "Solutions"
]

COMPANY_SUFFIXES = [
    "Ltd", "Corp", "Inc", "LLC", "Group", "PLC", "GmbH", "S.A.", "Trust", "Holdings", "Ventures", "Co"
]

def generate_company_name(account_id: str, index: int) -> str:
    """Generates a distinct, authentic company name for an account ID."""
    # Hash account ID for deterministic mapping
    h_int = int(hashlib.sha256(account_id.encode("utf-8")).hexdigest(), 16)
    
    p = COMPANY_PREFIXES[h_int % len(COMPANY_PREFIXES)]
    m = COMPANY_MIDDLES[(h_int // len(COMPANY_PREFIXES)) % len(COMPANY_MIDDLES)]
    s = COMPANY_SUFFIXES[(h_int // (len(COMPANY_PREFIXES) * len(COMPANY_MIDDLES))) % len(COMPANY_SUFFIXES)]
    
    # Avoid duplicate exact phrases
    return f"{p} {m} {s}"

def main():
    uri = os.getenv("COGNODB_URI", "bolt+s://db-cc6dfd18.databases.cognodb.com")
    user = os.getenv("COGNODB_USER", "cognodb")
    password = os.getenv("COGNODB_PASSWORD", "8a8d87d593c550f2fa20dd248b2bf3db")

    print(f"Connecting to CognoDB at {uri}...")
    driver = GraphDatabase.driver(uri, auth=(user, password))
    
    with driver.session() as session:
        # 1. Fetch all accounts
        result = session.run("MATCH (a:Account) RETURN a.id AS id, a.bank AS bank, a.status AS status")
        accounts = [record.data() for record in result]
        print(f"Found {len(accounts)} distinct accounts in CognoDB.")

        # 2. Build unique company names
        seen_names = set()
        updates = []
        for i, acc in enumerate(accounts):
            acc_id = acc["id"]
            name = generate_company_name(acc_id, i)
            
            # Ensure uniqueness
            dup_counter = 2
            original_name = name
            while name in seen_names:
                name = f"{original_name} {dup_counter}"
                dup_counter += 1
            seen_names.add(name)
            
            updates.append({"id": acc_id, "holderName": name})

        print("Sample of newly generated company names:")
        for u in updates[:10]:
            print(f"  {u['id']} -> {u['holderName']}")

        # 3. Batch update CognoDB using Cypher parameter batching
        batch_size = 250
        print(f"Updating {len(updates)} accounts in CognoDB in batches of {batch_size}...")
        for b_idx in range(0, len(updates), batch_size):
            batch = updates[b_idx:b_idx + batch_size]
            for item in batch:
                session.run(
                    "MATCH (a:Account) WHERE a.id = $id SET a.holderName = $holderName",
                    {"id": item["id"], "holderName": item["holderName"]}
                )
            print(f"  Processed {min(b_idx + batch_size, len(updates))}/{len(updates)} accounts...")

        print("\nVerification: Inspecting 10 accounts from CognoDB:")
        verify_res = session.run("MATCH (a:Account) RETURN a.id AS id, a.holderName AS holderName, a.status AS status, a.riskScore AS riskScore LIMIT 10")
        for r in verify_res:
            d = r.data()
            print(f"  [{d['status']}] {d['holderName']} (Score: {d['riskScore']})")

    driver.close()
    print("\nSuccessfully populated distinct company names across all accounts in CognoDB!")

if __name__ == "__main__":
    main()
