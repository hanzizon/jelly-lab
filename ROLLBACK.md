# Rollback checkpoint

User-requested checkpoint: **6db10f4a2ffdb38a529a106ce6dce63be7d91060**.

This is the faster simulation before the Jelly Jam clarity and character changes. Defaults: mass 1.25, firmness 0.06, damping 0.95, smoothing 0.08. Gravity 13.5, release speed limit 3.5. Jelly Lab title and intermediate two-pass blue material are preserved in that commit.

Restore the production files from that commit into a new commit on main, removing shapes.js if unused. Do not force-reset main or discard unrelated later changes. For material-only rollback, restore only the material and lighting code and preserve the current physics and UI.

The earlier public version before speed fixes is 74e7fe263a5ef09533a97fc4ddbe64c57dacde1d.
