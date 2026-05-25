import csv
import json
import os
from datetime import datetime

def analyze_leads(csv_path):
    if not os.path.exists(csv_path): return {"total": 0}
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        leads = list(reader)
    
    statuses = {}
    for lead in leads:
        st = lead.get('Status', 'Unknown')
        statuses[st] = statuses.get(st, 0) + 1
        
    return {
        "total_leads": len(leads),
        "pipeline_velocity": statuses,
        "conversion_probability": "0.00% (Insufficient Data)" if statuses.get("Purchased", 0) == 0 else f"{(statuses.get('Purchased', 0) / len(leads)) * 100:.2f}%"
    }

def generate_strategy(lead_data):
    strategy = {
        "timestamp": datetime.now().isoformat(),
        "data_science_metrics": lead_data,
        "current_bottleneck": "Distribution & Conversion Validation" if lead_data.get('total_leads', 0) < 100 else "Optimization",
        "recommended_action": "Scale outbound volume to 100 leads to achieve statistical significance before optimizing ML models."
    }
    with open('business_os/intelligence/current_strategy.json', 'w') as f:
        json.dump(strategy, f, indent=2)
    return strategy

if __name__ == "__main__":
    data = analyze_leads('business_os/leads.csv')
    strat = generate_strategy(data)
    print("DS Pipeline Executed. Current Strategy state:")
    print(json.dumps(strat, indent=2))
