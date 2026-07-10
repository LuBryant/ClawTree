import json
from pathlib import Path
from urllib.parse import urljoin

import requests

from ..schema import SourceCandidate


DEFAULT_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}


class BaseSourceAdapter:
    source_id = ''
    source_name = ''
    source_kind = ''
    search_url = ''

    def __init__(self, session=None, fixture_path=None, timeout=30):
        self.session = session or requests.Session()
        self.timeout = timeout
        self.fixture = self._load_fixture(fixture_path) if fixture_path else None

    @staticmethod
    def _load_fixture(path):
        with Path(path).open('r', encoding='utf-8') as fixture_file:
            fixture = json.load(fixture_file)
        if not isinstance(fixture.get('search_html'), str):
            raise ValueError('source fixture requires search_html')
        if not isinstance(fixture.get('pages'), dict):
            raise ValueError('source fixture requires pages object')
        return fixture

    def discover(self, keywords=None, max_results=10):
        if self.fixture is not None:
            search_url = self.fixture.get('search_url') or self.search_url
            html = self.fixture['search_html']
        else:
            search_url, html = self.fetch_search(keywords or [])
        candidates = self.parse_search(html, search_url)
        return candidates[:max_results]

    def fetch_search(self, keywords):
        raise NotImplementedError

    def parse_search(self, html, search_url):
        raise NotImplementedError

    def fetch_detail(self, candidate):
        if self.fixture is not None:
            try:
                return self.fixture['pages'][candidate.url]
            except KeyError as error:
                raise ValueError(f'fixture page missing for {candidate.url}') from error
        response = self.session.get(
            candidate.url,
            headers=DEFAULT_HEADERS,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.text

    def candidate(self, *, title, url, summary='', discovered_from='', raw_evidence=''):
        return SourceCandidate(
            source_id=self.source_id,
            source_name=self.source_name,
            source_kind=self.source_kind,
            title=title.strip(),
            url=urljoin(discovered_from or self.search_url, url.strip()),
            summary=summary.strip(),
            discovered_from=discovered_from or self.search_url,
            raw_evidence=raw_evidence.strip(),
        )
