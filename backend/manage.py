#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys

# 在 Django 导入前加载 .env 文件
from pathlib import Path


def _load_dotenv():
    """加载项目根目录和上级目录的 .env 文件"""
    try:
        from dotenv import load_dotenv
        # 优先加载上级目录（ClawTree 项目根）的 .env
        root_env = Path(__file__).resolve().parent.parent / '.env'
        if root_env.exists():
            load_dotenv(root_env)
        # 再加载 backend 自身的 .env（可覆盖）
        local_env = Path(__file__).resolve().parent / '.env'
        if local_env.exists():
            load_dotenv(local_env, override=True)
    except ImportError:
        pass


def main():
    _load_dotenv()

    # 如果期望使用 PyMySQL 作为 MySQL 驱动（非 mysqlclient），取消下面的注释：
    # try:
    #     import pymysql
    #     pymysql.install_as_MySQLdb()
    # except ImportError:
    #     pass

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
