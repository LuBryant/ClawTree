"""Pure database configuration builder, isolated for credential-boundary tests."""


class DatabaseConfigurationError(RuntimeError):
    pass


def build_database_config(environ, base_dir, debug):
    engine = (environ.get('DATABASE_ENGINE') or 'sqlite').lower()

    if engine == 'sqlite':
        return {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': environ.get('SQLITE_PATH') or base_dir / 'db.sqlite3',
            },
        }

    if engine != 'mysql':
        raise DatabaseConfigurationError('DATABASE_ENGINE must be sqlite or mysql')

    def required(name):
        value = environ.get(name)
        if not value:
            raise DatabaseConfigurationError(
                f'{name} is required when DATABASE_ENGINE=mysql',
            )
        return value

    user = required('MYSQL_USER')
    if not debug and user.lower() == 'root':
        raise DatabaseConfigurationError(
            'MYSQL_USER must be a least-privilege user in production',
        )

    return {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': required('MYSQL_DATABASE'),
            'HOST': required('MYSQL_HOST'),
            'USER': user,
            'PASSWORD': required('MYSQL_PASSWORD'),
            'PORT': environ.get('MYSQL_PORT') or '3306',
            'OPTIONS': {'charset': 'utf8mb4'},
        },
    }
