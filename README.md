# Firstmate Swarm Smoke Test
Results: alpha=todo; beta=todo; gamma=todo

## unitcalc

`unitcalc` is a Python 3.10+ calculator package that uses only the standard library.

### Number formatting

`unitcalc.fmt.format_number(x, sig=6, notation="auto")` rounds to significant figures and strips insignificant fractional zeroes. The `auto` notation uses fixed form for magnitudes from `1e-4` up to (but not including) `1e9`, and scientific form outside that range. Choose `fixed`, `sci`, or `eng` explicitly when needed; engineering exponents are multiples of three.

```python
from unitcalc import format_number

format_number(999.96, sig=4)                 # "1000"
format_number(12345, sig=3, notation="eng")  # "12.3e3"
```
