import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config.database import DatabaseConfigurationError, build_database_config


class DatabaseConfigurationTests(unittest.TestCase):
    def test_local_default_is_credential_free_sqlite(self):
        config = build_database_config({}, Path('/tmp/clawtree'), debug=True)
        self.assertEqual(config['default']['ENGINE'], 'django.db.backends.sqlite3')
        self.assertEqual(config['default']['NAME'], Path('/tmp/clawtree/db.sqlite3'))

    def test_mysql_requires_every_credential_field(self):
        complete = {
            'DATABASE_ENGINE': 'mysql',
            'MYSQL_DATABASE': 'clawtree',
            'MYSQL_HOST': 'db.invalid',
            'MYSQL_USER': 'clawtree_app',
            'MYSQL_PASSWORD': 'fixture-only-password',
        }
        for missing in ('MYSQL_DATABASE', 'MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD'):
            with self.subTest(missing=missing):
                environ = {key: value for key, value in complete.items() if key != missing}
                with self.assertRaisesRegex(DatabaseConfigurationError, missing):
                    build_database_config(environ, Path('/tmp/clawtree'), debug=False)

    def test_production_rejects_root_database_user(self):
        environ = {
            'DATABASE_ENGINE': 'mysql',
            'MYSQL_DATABASE': 'clawtree',
            'MYSQL_HOST': 'db.invalid',
            'MYSQL_USER': 'root',
            'MYSQL_PASSWORD': 'fixture-only-password',
        }
        with self.assertRaisesRegex(DatabaseConfigurationError, 'least-privilege'):
            build_database_config(environ, Path('/tmp/clawtree'), debug=False)

    def test_mysql_uses_environment_values(self):
        environ = {
            'DATABASE_ENGINE': 'mysql',
            'MYSQL_DATABASE': 'clawtree_test',
            'MYSQL_HOST': 'db.invalid',
            'MYSQL_USER': 'clawtree_app',
            'MYSQL_PASSWORD': 'fixture-only-password',
            'MYSQL_PORT': '3307',
        }
        config = build_database_config(environ, Path('/tmp/clawtree'), debug=False)['default']
        self.assertEqual(config['NAME'], environ['MYSQL_DATABASE'])
        self.assertEqual(config['HOST'], environ['MYSQL_HOST'])
        self.assertEqual(config['USER'], environ['MYSQL_USER'])
        self.assertEqual(config['PASSWORD'], environ['MYSQL_PASSWORD'])
        self.assertEqual(config['PORT'], environ['MYSQL_PORT'])


if __name__ == '__main__':
    unittest.main()
