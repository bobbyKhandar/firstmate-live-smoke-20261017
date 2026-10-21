import unittest

from unitcalc import DimensionError, UnitError, __all__, __version__, convert


class UnitConversionTests(unittest.TestCase):
    def test_package_exports_units_api(self):
        self.assertEqual(__version__, "0.1.0")
        self.assertTrue({"DimensionError", "UnitError", "convert"}.issubset(__all__))
        self.assertEqual(__all__, sorted(__all__))
        self.assertTrue(issubclass(DimensionError, UnitError))

    def test_each_linear_unit_converts_to_its_base_unit(self):
        cases = (
            ("m", "m", 1.0),
            ("km", "m", 1000.0),
            ("cm", "m", 0.01),
            ("mm", "m", 0.001),
            ("in", "m", 0.0254),
            ("ft", "m", 0.3048),
            ("yd", "m", 0.9144),
            ("mi", "m", 1609.344),
            ("g", "kg", 0.001),
            ("kg", "kg", 1.0),
            ("lb", "kg", 0.45359237),
            ("oz", "kg", 0.45359237 / 16),
            ("s", "s", 1.0),
            ("ms", "s", 0.001),
            ("min", "s", 60.0),
            ("h", "s", 3600.0),
            ("N", "kg*m/s^2", 1.0),
            ("J", "kg*m^2/s^2", 1.0),
            ("K", "K", 1.0),
        )
        for source, base, factor in cases:
            with self.subTest(source=source, base=base):
                self.assertAlmostEqual(convert(1.0, source, base), factor)
                self.assertAlmostEqual(convert(factor, base, source), 1.0)
                self.assertAlmostEqual(convert(7.25, source, source), 7.25)

    def test_representative_reverse_and_identity_conversions(self):
        self.assertAlmostEqual(convert(1000, "m", "km"), 1.0)
        self.assertAlmostEqual(convert(1, "mi", "ft"), 5280.0)
        self.assertAlmostEqual(convert(16, "oz", "lb"), 1.0)
        self.assertAlmostEqual(convert(60, "s", "min"), 1.0)
        self.assertAlmostEqual(convert(2.5, "km", "km"), 2.5)

    def test_compound_units_and_derived_units(self):
        self.assertAlmostEqual(convert(100, "km/h", "m/s"), 100 / 3.6)
        self.assertAlmostEqual(convert(1, "m/s^2", "cm/s^2"), 100.0)
        self.assertAlmostEqual(convert(1, "kg*m/s^2", "N"), 1.0)
        self.assertAlmostEqual(convert(1, "N", "kg*m/s^2"), 1.0)
        self.assertAlmostEqual(convert(1, "N*m", "J"), 1.0)
        self.assertAlmostEqual(convert(1, "J", "N*m"), 1.0)
        self.assertAlmostEqual(convert(1, "ft*lb", "m*kg"), 0.3048 * 0.45359237)
        self.assertAlmostEqual(convert(1, "m^3", "cm^3"), 1_000_000.0)

    def test_compound_operators_are_applied_left_to_right(self):
        self.assertAlmostEqual(convert(12, "m/s*s", "m"), 12.0)

    def test_signed_and_zero_exponents(self):
        self.assertAlmostEqual(convert(1, "m^-1", "km^-1"), 1000.0)
        self.assertAlmostEqual(convert(1, "m^+2", "cm^2"), 10_000.0)
        self.assertAlmostEqual(convert(4.5, "m^0", "s^0"), 4.5)

    def test_incompatible_dimensions_name_both_original_units(self):
        with self.assertRaises(DimensionError) as caught:
            convert(1, "cm", "s")
        self.assertIn("cm", str(caught.exception))
        self.assertIn("s", str(caught.exception))

    def test_unknown_units_raise_unit_error(self):
        with self.assertRaisesRegex(UnitError, "furlong"):
            convert(1, "furlong", "m")
        with self.assertRaises(UnitError):
            convert(1, "m", "KM")

    def test_empty_or_malformed_unit_expressions_raise_unit_error(self):
        for source in ("", "   ", "m/", "*m", "m**s", "(m)", "m^", "m^2.5", "m kg", "m^2tail"):
            with self.subTest(source=source):
                with self.assertRaises(UnitError):
                    convert(1, source, "m")

    def test_affine_temperature_units_are_rejected_in_compounds(self):
        invalid = ("degC*m", "m/degC", "degF*s", "s*degF")
        for expression in invalid:
            with self.subTest(expression=expression):
                with self.assertRaises(UnitError):
                    convert(1, expression, "K")
                with self.assertRaises(UnitError):
                    convert(1, "K", expression)

    def test_affine_temperature_units_reject_even_explicit_unit_exponents(self):
        for expression in ("degC^1", "degC^0", "degF^1", "degF^0"):
            with self.subTest(expression=expression):
                with self.assertRaises(UnitError):
                    convert(1, expression, "K")

    def test_kelvin_is_allowed_in_compounds_and_with_exponents(self):
        self.assertAlmostEqual(convert(3, "K/s", "K/s"), 3.0)
        self.assertAlmostEqual(convert(2, "K^2", "K^2"), 2.0)
        self.assertAlmostEqual(convert(4, "K*m^0", "K"), 4.0)

    def test_affine_temperature_conversions(self):
        self.assertEqual(convert(100, "degC", "degF"), 212.0)
        self.assertAlmostEqual(convert(0, "degF", "K"), 255.3722222222)
        self.assertAlmostEqual(convert(0, "degC", "K"), 273.15)
        self.assertAlmostEqual(convert(273.15, "K", "degC"), 0.0)
        self.assertAlmostEqual(convert(212, "degF", "degC"), 100.0)
        self.assertAlmostEqual(convert(373.15, "K", "degF"), 212.0)


if __name__ == "__main__":
    unittest.main()
