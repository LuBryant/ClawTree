from bs4 import BeautifulSoup

from .base import BaseSourceAdapter, DEFAULT_HEADERS


class HuodongxingSourceAdapter(BaseSourceAdapter):
    source_id = 'huodongxing'
    source_name = '活动行'
    source_kind = 'event_platform'
    search_url = 'https://www.huodongxing.com/search'

    def fetch_search(self, keywords):
        query = ' '.join(keywords[:3]) or '高校 AI Web3'
        response = self.session.get(
            self.search_url,
            params={'q': query, 'city': '全国'},
            headers=DEFAULT_HEADERS,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.url, response.text

    def parse_search(self, html, search_url):
        soup = BeautifulSoup(html, 'lxml')
        candidates = []
        for item in soup.select('.search-item, .event-item, div[class*="event"]'):
            link = item.select_one('a[href*="event"]')
            if not link:
                continue
            title = link.get('title') or link.get_text(' ', strip=True)
            href = link.get('href', '')
            if not title or not href:
                continue
            summary_element = item.select_one('.desc, .summary, p')
            summary = summary_element.get_text(' ', strip=True) if summary_element else ''
            candidates.append(self.candidate(
                title=title,
                url=href,
                summary=summary,
                discovered_from=search_url,
                raw_evidence=item.get_text(' ', strip=True),
            ))
        return candidates
