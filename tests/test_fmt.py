import math
import unittest

from unitcalc.fmt import format_number


class FormatNumberTests(unittest.TestCase):
    def test_auto_uses_significant_figures_and_strips_fractional_zeros(self):
        self.assertEqual(format_number(999.96, sig=4), "1000")
        self.assertEqual(format_number(0.000123456, sig=3), "0.000123")
        self.assertEqual(format_number(2.50), "2.5")
        self.assertEqual(format_number(1.23456789), "1.23457")
        self.assertEqual(format_number(-12.34567, sig=4), "-12.35")

    def test_auto_notation_thresholds_and_zero(self):
        self.assertEqual(format_number(0.0), "0")
        self.assertEqual(format_number(-0.0), "0")
        self.assertEqual(format_number(0.0001), "0.0001")
        self.assertEqual(format_number(0.00009999), "9.999e-5")
        self.assertEqual(format_number(999999999), "1000000000")
        self.assertEqual(format_number(999999999, sig=9), "999999999")
        self.assertEqual(format_number(1e9), "1e+9")
        self.assertEqual(format_number(999999999, sig=6), "1000000000")

    def test_fixed_notation_handles_small_and_large_values(self):
        self.assertEqual(format_number(1.2345e-8, sig=3, notation="fixed"), "0.0000000123")
        self.assertEqual(format_number(12345, sig=3, notation="fixed"), "12300")
        self.assertEqual(format_number(2.5, sig=2, notation="fixed"), "2.5")
        self.assertEqual(format_number(2.5, sig=6, notation="fixed"), "2.5")
        self.assertEqual(format_number(-2.5, sig=2, notation="fixed"), "-2.5")

    def test_scientific_notation_normalizes_after_rounding(self):
        self.assertEqual(format_number(12345678901, sig=3, notation="sci"), "1.23e+10")
        self.assertEqual(format_number(-0.001234, sig=3, notation="sci"), "-1.23e-3")
        self.assertEqual(format_number(999.96, sig=3, notation="sci"), "1e+3")
        self.assertEqual(format_number(12300, sig=2, notation="sci"), "1.2e+4")

    def test_engineering_notation_uses_exponents_in_multiples_of_three(self):
        self.assertEqual(format_number(12345, sig=3, notation="eng"), "12.3e3")
        self.assertEqual(format_number(-12345, sig=3, notation="eng"), "-12.3e3")
        self.assertEqual(format_number(0.000012345, sig=3, notation="eng"), "12.3e-6")
        self.assertEqual(format_number(999.96, sig=3, notation="eng"), "1e3")
        self.assertEqual(format_number(12300, sig=2, notation="eng"), "12e3")

    def test_ties_round_to_even(self):
        self.assertEqual(format_number(2.5, sig=1), "2")
        self.assertEqual(format_number(3.5, sig=1), "4")
        self.assertEqual(format_number(-2.5, sig=1), "-2")
        self.assertEqual(format_number(1.25, sig=2), "1.2")
        self.assertEqual(format_number(1.35, sig=2), "1.4")

    def test_rounded_zero_is_never_negative_zero(self):
        for notation in ("fixed", "sci", "eng"):
            self.assertEqual(format_number(-0.0, notation=notation), "0")

    def test_special_values(self):
        self.assertEqual(format_number(math.nan), "nan")
        self.assertEqual(format_number(math.inf), "inf")
        self.assertEqual(format_number(-math.inf), "-inf")

    def test_invalid_significant_figures_and_notation_raise_value_error(self):
        for sig in (0, -1):
            with self.subTest(sig=sig):
                with self.assertRaises(ValueError):
                    format_number(1.0, sig=sig)
        with self.assertRaises(ValueError):
            format_number(1.0, sig=1.5)
        with self.assertRaises(ValueError):
            format_number(1.0, notation="engineering")


if __name__ == "__main__":
    unittest.main()
