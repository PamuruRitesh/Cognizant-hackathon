import json
import random
from datetime import datetime, timedelta

with open('data/processed/recommendations.json', 'r') as f:
    base_recs = json.load(f)

new_recs = []
base_date = datetime.strptime('2018-08-14', '%Y-%m-%d')

for i in range(10):
    current_date = (base_date - timedelta(days=i)).strftime('%Y-%m-%d')
    for r in base_recs:
        nr = r.copy()
        nr['date'] = current_date
        nr['recommended_qty'] = max(0, round(r['recommended_qty'] * random.uniform(0.8, 1.2)))
        if 'cost_if_ignored' in nr:
            nr['cost_if_ignored'] = round(nr['cost_if_ignored'] * random.uniform(0.8, 1.2), 2)
        if 'stockout_risk_7d' in nr:
            nr['stockout_risk_7d'] = max(0.0, min(1.0, nr['stockout_risk_7d'] + random.uniform(-0.1, 0.1)))
        
        # Keep a healthy mix of pending items on all dates for demo purposes
        rand_val = random.random()
        if rand_val < 0.2:
            nr['status'] = 'approved'
        elif rand_val < 0.3:
            nr['status'] = 'rejected'
        else:
            nr['status'] = 'pending'
        
        nr['rec_id'] = f"REC-{current_date}-{nr['product_id'][:8]}"
        new_recs.append(nr)

with open('data/processed/recommendations.json', 'w') as f:
    json.dump(new_recs, f, indent=2)

print(f'Generated {len(new_recs)} recommendations over 10 days.')
