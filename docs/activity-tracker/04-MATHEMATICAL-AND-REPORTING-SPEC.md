# Activity & Progress Tracker — Mathematical & Reporting Specification

## 1. Automatic Parent Progress Formula

For any parent activity configured with `progressMode = 'AUTOMATIC'`:

$$P_{\text{parent}} = \sum_{i=1}^{N} \left( P_{\text{child}, i} \times \frac{W_i}{100} \right)$$

Where:
- $N$ is the number of active Level 2 child activities belonging to this parent.
- $P_{\text{child}, i}$ is the cumulative progress of child $i$ ($0.00 \le P_{\text{child}, i} \le 100.00$).
- $W_i$ is the configured weightage of child $i$ ($W_i > 0$).
- The system enforces the invariant:
  $$\sum_{i=1}^{N} W_i = 100.00\% \quad (\pm 0.01\% \text{ tolerance})$$

### Concrete Example:
- Child 1 (Raft Reinforcement): $100\%$ progress, $30\%$ weightage $\rightarrow 100 \times 0.30 = 30.0\%$
- Child 2 (Formwork Installation): $100\%$ progress, $40\%$ weightage $\rightarrow 100 \times 0.40 = 40.0\%$
- Child 3 (Concrete Pouring): $65\%$ progress, $10\%$ weightage $\rightarrow 65 \times 0.10 = 6.5\%$
- Child 4 (Curing & De-shuttering): $0\%$ progress, $20\%$ weightage $\rightarrow 0 \times 0.20 = 0.0\%$
- **Parent Cumulative Progress:**
  $$P_{\text{parent}} = 30.0 + 40.0 + 6.5 + 0.0 = 76.5\%$$

---

## 2. Historical Weightage Versioning

When management adjusts child weightages, previous historical reports must **never** be retroactively altered.

To ensure immutable historical integrity:
1. Every weightage adjustment appends a new version entry into `parent.weightageHistory`:
   ```ts
   {
     version: number,
     effectiveFrom: 'YYYY-MM-DD',
     effectiveTo: 'YYYY-MM-DD' | null, // null indicates current active version
     weightages: [ { childActivityId, weightage } ],
     reason: string,
     changedBy: ObjectId,
     changedAt: Date
   }
   ```
2. When generating a report for date $D$, the system queries the active weightage version where:
   $$\text{effectiveFrom} \le D \le (\text{effectiveTo} \lor \infty)$$
3. Reports generated for dates prior to the adjustment automatically resolve the historic version, ensuring $100\%$ reporting reproducibility.

---

## 3. Reporting Delta Mathematical Engine

For any reporting window from Start Date ($D_{\text{start}}$) to End Date ($D_{\text{end}}$):

### 1. Starting Progress ($P_{\text{start}}$)
$$D_{\text{prior}} = D_{\text{start}} - 1 \text{ day}$$
$P_{\text{start}}$ is defined as the latest cumulative progress recorded on or before $D_{\text{prior}}$.
If no daily update exists on or before $D_{\text{prior}}$, $P_{\text{start}} = 0.00\%$.

### 2. Ending Progress ($P_{\text{end}}$)
$P_{\text{end}}$ is defined as the latest cumulative progress recorded on or before $D_{\text{end}}$.
If no update exists up to $D_{\text{end}}$, $P_{\text{end}} = P_{\text{start}}$.

### 3. Period Progress Delta ($\Delta P$)
$$\Delta P = P_{\text{end}} - P_{\text{start}}$$

### Why this formula is mathematically rigorous:
- Work completed on $D_{\text{start}}$ is **included** in the period:
  - Example: An activity was at $20\%$ on Monday ($D-1$). On Tuesday ($D_{\text{start}}$), it progresses to $35\%$. On Friday ($D_{\text{end}}$), it reaches $60\%$.
  - $P_{\text{start}} = \text{progress on Monday} = 20\%$.
  - $P_{\text{end}} = \text{progress on Friday} = 60\%$.
  - $\Delta P = 60\% - 20\% = 40\%$ (accurately accounting for the $15\%$ achieved on Tuesday plus $25\%$ achieved Wednesday through Friday).

---

## 4. Overall Block Cumulative Progress

The overall block progress is computed as the unweighted mean of all Level 1 summary activities (or weighted if block-level packages are configured):

$$P_{\text{block}} = \frac{1}{M} \sum_{k=1}^{M} P_{\text{L1}, k}$$

Where $M$ is the count of active Level 1 summary activities in the block.

