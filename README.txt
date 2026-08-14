
1) Multi filter IDs: "1,2,3" no longer parseInt to 1 only
   SQL example:
   WHERE salesman_id IN (SELECT TRY_CAST(LTRIM(RTRIM(value)) AS INT) FROM STRING_SPLIT(@salesman_id, ','))

2) Filter ↑ ↓ reorder in GlobalFiltersEditor

3) Suggest global filters: APPEND only, never delete existing

4) Widget configure open → Widget goş palette hidden; close panel → shows again
