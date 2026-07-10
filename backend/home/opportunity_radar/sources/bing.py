from bs4 import BeautifulSoup

from .base import BaseSourceAdapter, DEFAULT_HEADERS


class BingSourceAdapter(BaseSourceAdapter):
    source_id = 'bing'
    source_name = 'Bing搜索'
    source_kind = 'search'
    search_url = 'https://www.bing.com/search'

    def fetch_search(self, keywords):
        query = ' OR '.join(keywords[:4]) or '高校 AI Web3 活动'
        response = self.session.get(
            self.search_url,
            params={'q': query, 'setlang': 'zh-Hans'},
            headers=DEFAULT_HEADERS,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.url, response.text

    def parse_search(self, html, search_url):
        soup = BeautifulSoup(html, 'lxml')
        candidates = []
        for item in soup.select('li.b_algo'):
            link = item.select_one('h2 a')
            if not link or not link.get('href') or not link.get_text(strip=True):
                continue
            summary_element = item.select_one('.b_caption p')
            summary = summary_element.get_text(' ', strip=True) if summary_element else ''
            candidates.append(self.candidate(
                title=link.get_text(' ', strip=True),
                url=link['href'],
                summary=summary,
                discovered_from=search_url,
                raw_evidence=item.get_text(' ', strip=True),
            ))
        return candidates
