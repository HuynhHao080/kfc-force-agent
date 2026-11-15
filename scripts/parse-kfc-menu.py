"""Parse scoped KFC HTML returned by TinyFish Fetch without guessing image associations."""
import hashlib
import json
import re
import sys
import unicodedata
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


class Node:
    def __init__(self, tag='', attrs=()):
        self.tag = tag
        self.attrs = dict(attrs)
        self.children = []

    def text(self):
        return ' '.join(child.text() if isinstance(child, Node) else child for child in self.children).strip()

    def find(self, predicate):
        for child in self.children:
            if isinstance(child, Node):
                if predicate(child):
                    yield child
                yield from child.find(predicate)

    def has_class(self, name):
        return name in self.attrs.get('class', '').split()


class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in {'img', 'source', 'br', 'input', 'hr', 'meta', 'link', 'wbr', 'area', 'embed'}:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def clean(value):
    return ' '.join(unicodedata.normalize('NFC', value).split())


def parse_catalog(response):
    if response.get('errors') or len(response.get('results', [])) != 1:
        raise ValueError('TinyFish fetch must contain exactly one successful KFC page.')
    page = response['results'][0]
    for key in ['url', 'final_url']:
        parsed = urlparse(page.get(key, ''))
        if parsed.scheme != 'https' or parsed.netloc != 'kfcvietnam.com.vn':
            raise ValueError('Unexpected KFC source URL.')
    parser = Parser()
    parser.feed(page['text'])
    categories, items, exclusions = [], [], []
    current = None
    seen = set()
    for node in parser.root.find(lambda item: item.tag == 'h1' or item.has_class('item-card')):
        if node.tag == 'h1':
            name = clean(node.text())
            current = 'kfc_cat_' + re.sub(r'[^a-zA-Z0-9_-]', '', node.attrs.get('id', ''))
            if current == 'kfc_cat_':
                raise ValueError('Category source ID is missing.')
            categories.append({'id': current, 'name': name, 'displayOrder': len(categories)})
            continue
        name_node = next(node.find(lambda item: item.has_class('title')), None)
        price_node = next(node.find(lambda item: item.has_class('price')), None)
        image = next(node.find(lambda item: item.tag == 'img'), None)
        description = next(node.find(lambda item: item.has_class('content')), None)
        if not current or name_node is None or price_node is None or image is None:
            raise ValueError('Product structure changed, review the scoped source HTML.')
        name = clean(name_node.text())
        prices = re.findall(r'([0-9][0-9.,]*)\s*₫', price_node.text())
        if not prices:
            exclusions.append(name + ': missing VND price')
            continue
        identity = hashlib.sha256(name.casefold().encode()).hexdigest()[:20]
        if identity in seen:
            exclusions.append(name + ': duplicate listing')
            continue
        seen.add(identity)
        disabled = any(item.attrs.get('aria-disabled') == 'true' for item in node.find(lambda item: item.tag == 'a'))
        items.append({
            'id': 'kfc_item_' + identity, 'categoryId': current, 'name': name,
            'description': clean(description.text()) if description else '',
            'price': int(re.sub(r'[^0-9]', '', prices[0])),
            'imageUrl': image.attrs.get('src', ''), 'sourceUrl': page['final_url'],
            'isAvailable': not disabled,
        })
    if not categories or not items:
        raise ValueError('No KFC categories or products found in the scoped page.')
    return {'categories': categories, 'items': items, 'exclusions': exclusions}


if __name__ == '__main__':
    result = parse_catalog(json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig')))
    print(json.dumps(result, ensure_ascii=False))
