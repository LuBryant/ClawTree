from bs4 import BeautifulSoup

from .base import BaseSourceAdapter, DEFAULT_HEADERS


class CCFSourceAdapter(BaseSourceAdapter):
    source_id = 'ccf'
    source_name = 'CCF（中国计算机学会）'
    source_kind = 'academic_society'
    search_url = 'https://www.ccf.org.cn/Activities/'

    def fetch_search(self, keywords):
        response = self.session.get(
            self.search_url,
            headers=DEFAULT_HEADERS,
            timeout=self.timeout,
        )
        response.raise_for_status()
        response.encoding = response.apparent_encoding or 'utf-8'
        return response.url, response.text

    def parse_search(self, html, search_url):
        soup = BeautifulSoup(html, 'lxml')
        candidates = []
        selectors = 'div.activities-list a, .activities-list a, a.activity, a[data-event]'
        for link in soup.select(selectors):
            title = link.get_text(' ', strip=True)
            href = link.get('href', '')
            if not title or not href:
                continue
            candidates.append(self.candidate(
                title=title,
                url=href,
                summary=link.get('title', ''),
                discovered_from=search_url,
                raw_evidence=str(link),
            ))
        return candidates
