from .bing import BingSourceAdapter
from .ccf import CCFSourceAdapter
from .huodongxing import HuodongxingSourceAdapter


SOURCE_ADAPTERS = {
    'bing': BingSourceAdapter,
    'ccf': CCFSourceAdapter,
    'huodongxing': HuodongxingSourceAdapter,
}


def build_adapter(source_id, **kwargs):
    try:
        adapter_class = SOURCE_ADAPTERS[source_id]
    except KeyError as error:
        raise ValueError(f'unknown opportunity source: {source_id}') from error
    return adapter_class(**kwargs)


__all__ = [
    'BingSourceAdapter',
    'CCFSourceAdapter',
    'HuodongxingSourceAdapter',
    'SOURCE_ADAPTERS',
    'build_adapter',
]
