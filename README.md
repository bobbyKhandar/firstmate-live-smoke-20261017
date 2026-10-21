# Firstmate Swarm Smoke Test
Results: alpha=todo; beta=todo; gamma=todo

## unitcalc

`unitcalc` is a dependency-free Python 3.10+ expression calculator and unit converter. The package uses only the Python standard library.

### Units and conversion

`unitcalc.convert(value, from_unit, to_unit)` converts values between compatible units and raises `UnitError` for unknown or malformed units and `DimensionError` for incompatible dimensions. Supported base units include `m`, `kg`, `s`, and `K`; the package also supports `km`, `cm`, `mm`, `in`, `ft`, `yd`, `mi`, `g`, `lb`, `oz`, `ms`, `min`, `h`, `N`, `J`, `degC`, and `degF`.

Compound units use `*`, `/`, and integer powers. Operators are evaluated from left to right, so `m/s*s` has the dimension of length. For example, `convert(100, "km/h", "m/s")` returns approximately `27.7778`, and `convert(100, "degC", "degF")` returns `212`. Celsius and Fahrenheit are affine temperature units and can be used only on their own; Kelvin can be used in compounds.
