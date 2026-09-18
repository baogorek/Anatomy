"""Native solver integration checks; engineering validation, not human ranges."""
import math
import unittest
from threading import Event, Lock

from engine import ModelEngine
from longest_path import Cancelled, find_longest, validate_request


class LongestPathTests(unittest.TestCase):
    engines = {}

    def engine(self, region):
        if region not in self.engines:
            self.engines[region] = ModelEngine(region)
        return self.engines[region]

    def run_search(self, region, muscle, coordinates=None, controls=None, **budget):
        e = self.engine(region)
        req = dict(region=region, muscle=muscle, coordinates=coordinates or {}, version=e.calculation_version)
        if controls is not None:
            req['controls'] = controls
        result = find_longest(e, req, Lock(), Event(), **budget)
        with self.subTest(region=region, muscle=muscle):
            self.assertGreaterEqual(result['gain'], 0)
            self.assertTrue(math.isfinite(result['length']))
            # Re-evaluate after an unrelated pose: result must not depend on
            # native wrapping caches or which candidate was last visited.
            e.evaluate({})
            independent = e.evaluate({'coordinates': result['coordinates']})
            sample = next(m for m in independent['muscles'] if m['id'] == muscle)
            self.assertTrue(sample['available'])
            self.assertAlmostEqual(sample['length'], result['length'], places=8)
            for c in e.controls:
                value = result['coordinates'][c['id']]
                self.assertGreaterEqual(value, c['min'])
                self.assertLessEqual(value, c['max'])
                self.assertLess(abs(independent['coordinates'][c['id']] - value), .001)
                if controls is not None and c['id'] not in controls:
                    self.assertEqual(value, (coordinates or {}).get(c['id'], e.baseline['coordinates'][c['id']]))
        return result

    def test_neck_known_result_and_unchanged_upper_controls(self):
        coords = dict(pitch1=-12, yaw1=7, roll1=3)
        result = self.run_search('neck', 'scalenus_ant_L', coords)
        self.assertAlmostEqual(result['length'] * 1000, 111.099718, places=4)
        for n, v in coords.items():
            self.assertEqual(result['coordinates'][n], v)
        # Running again from the best pose cannot regress it.
        again = self.run_search('neck', 'scalenus_ant_L', result['coordinates'])
        self.assertAlmostEqual(again['gain'], 0, places=8)

    def test_locked_control_cannot_move(self):
        coords = dict(pitch2=-10, yaw2=-8, roll2=0, pitch1=4)
        result = self.run_search('neck', 'scalenus_ant_L', coords, ['roll2'])
        self.assertGreater(result['gain'], .005)
        self.assertEqual(result['coordinates']['roll2'], 20)

    def test_native_regions_and_sign_adapters(self):
        cases = [
            ('shoulder', 'DeltoideusScapula_M', ['shoulder_elv', 'axial_rot']),
            ('hip', 'bflh_r', ['hip_flexion_r', 'knee_angle_r']),
            ('arm', 'BIClong', ['elbow_flexion']),
            ('spine', 'spine__MF_m1s_r', ['L3_L4_FE']),
            ('wholebody', 'wholebody__bifemlh_l', ['hip_flexion_l', 'knee_angle_l']),
        ]
        for region, muscle, controls in cases:
            initial = {'elbow_flexion': 90} if region == 'arm' else None
            result = self.run_search(region, muscle, initial, controls=controls)
            self.assertGreater(result['gain'], .001, (region, result['rejected']))

    def test_invalid_requests_and_unavailable_paths(self):
        e = self.engine('neck')
        good = dict(version=e.calculation_version, muscle='scalenus_ant_L', coordinates={})
        for updates in [dict(version='old'), dict(muscle='missing'), dict(coordinates={'bad': 0}),
                        dict(coordinates={'pitch2': True}), dict(coordinates={'pitch2': float('nan')}),
                        dict(coordinates={'pitch2': 31}), dict(controls=[]), dict(controls=['bad']),
                        dict(controls=['roll2', 'roll2'])]:
            with self.assertRaises(ValueError):
                validate_request(e, {**good, **updates})
        with self.assertRaisesRegex(ValueError, 'unavailable'):
            self.run_search('arm', 'SUP', dict(pro_sup=20))
        # A valid start must never yield the known-unreliable pronated branch.
        result = self.run_search('arm', 'SUP', dict(pro_sup=-20), ['pro_sup'])
        self.assertLessEqual(result['coordinates']['pro_sup'], 0)

    def test_cancellation_and_budget_fallback(self):
        e = self.engine('neck')
        request = dict(version=e.calculation_version, muscle='scalenus_ant_L', coordinates={})
        cancelled = Event()
        cancelled.set()
        with self.assertRaises(Cancelled):
            find_longest(e, request, Lock(), cancelled)
        result = self.run_search('neck', 'scalenus_ant_L', max_evaluations=1)
        self.assertTrue(result['budgetLimited'])
        self.assertEqual(result['gain'], 0)

    def test_control_below_both_attachments_cannot_change_path_length(self):
        # This native strand spans lumbar4 to lumbar1; L5–S1 moves both ends.
        result = self.run_search('spine', 'spine__MF_m1s_r', controls=['L5_S1_FE'])
        self.assertEqual(result['gain'], 0)
        self.assertEqual(result['coordinates']['L5_S1_FE'], 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
