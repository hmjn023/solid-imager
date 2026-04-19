# Bolt's Journal

## 2024-05-23 - Pagination Performance Anti-Pattern

**Learning:** Pagination often triggers two expensive queries: one for data (`SELECT * ... LIMIT X`) and one for total count (`SELECT count(*) ...`). Both re-evaluate the same complex filters (subqueries, joins).
**Action:** Use window functions (`count(*) OVER()`) to retrieve the total count within the main query. This reduces DB load by ~50% for complex filtered searches. **Crucial:** Remember that `OVER()` works on the _result set_, so if `LIMIT/OFFSET` returns 0 rows (page out of bounds), the total count is lost. You must implement a fallback `count(*)` query specifically for the "empty result + offset > 0" edge case.
