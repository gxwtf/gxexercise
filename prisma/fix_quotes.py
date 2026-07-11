#!/usr/bin/env python3
"""
将 seed-chinese.json 文件内容中中文语境下的半角引号替换为全角引号。
只处理 JSON 字符串值内部的引号，不破坏 JSON 结构。
"""

import json
import re
import sys


def replace_halfwidth_quotes(text: str) -> str:
    """在中文文本中，将半角引号替换为全角引号。"""

    # 半角双引号 " → 交替使用全角左引号 " 和右引号 "
    # 半角单引号 ' → 交替使用全角左引号 ' 和右引号 '
    result = []
    double_open = True  # 追踪双引号是开还是闭
    single_open = True  # 追踪单引号是开还是闭

    i = 0
    while i < len(text):
        ch = text[i]

        if ch == '"':
            # 检查前后是否有中文字符或中文标点，确认在中文语境中
            prev_char = text[i - 1] if i > 0 else ''
            next_char = text[i + 1] if i + 1 < len(text) else ''

            if _is_chinese_context(prev_char, next_char):
                result.append('\u201c' if double_open else '\u201d')
                double_open = not double_open
            else:
                result.append(ch)
            i += 1

        elif ch == "'":
            prev_char = text[i - 1] if i > 0 else ''
            next_char = text[i + 1] if i + 1 < len(text) else ''

            if _is_chinese_context(prev_char, next_char):
                result.append('\u2018' if single_open else '\u2019')
                single_open = not single_open
            else:
                result.append(ch)
            i += 1

        else:
            result.append(ch)
            i += 1

    return ''.join(result)


def _is_chinese_context(prev_char: str, next_char: str) -> bool:
    """判断当前引号是否处于中文语境中。"""
    prev_is_cn = _is_chinese_or_punct(prev_char) if prev_char else False
    next_is_cn = _is_chinese_or_punct(next_char) if next_char else False
    # 只要前后有一边是中文语境，就认为是中文引号
    return prev_is_cn or next_is_cn


def _is_chinese_or_punct(ch: str) -> bool:
    """判断字符是否为中文字符或中文标点。"""
    cp = ord(ch)
    return (
        (0x4E00 <= cp <= 0x9FFF) or      # CJK 统一汉字
        (0x3400 <= cp <= 0x4DBF) or      # CJK 扩展A
        (0x20000 <= cp <= 0x2A6DF) or    # CJK 扩展B
        (0x3000 <= cp <= 0x303F) or      # CJK 标点
        (0xFF00 <= cp <= 0xFFEF) or      # 全角字符
        (0xFE30 <= cp <= 0xFE4F) or      # CJK 兼容标点
        (0x2000 <= cp <= 0x206F) or      # 通用标点
        ch in '，。！？；：、（）【】《》「」『』…—～·'
    )


def process_json_values(obj):
    """递归遍历 JSON 对象，对每个字符串值替换引号。"""
    if isinstance(obj, str):
        return replace_halfwidth_quotes(obj)
    elif isinstance(obj, dict):
        return {k: process_json_values(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [process_json_values(item) for item in obj]
    else:
        return obj


def process_ts_file(filepath: str):
    """处理 .ts 文件中的中文引号。"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 对 .ts 文件，直接全文替换中文语境下的引号
    # 但要小心模板字符串中的反引号
    new_content = replace_halfwidth_quotes(content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"已处理: {filepath}")


def process_json_file(filepath: str):
    """处理 JSON 文件：先解析再替换值中的引号。"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 先尝试正常解析
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"JSON 解析失败 ({e})，尝试用正则修复...")
        # 如果 JSON 解析失败，使用正则直接替换中文语境下的引号
        # 注意：此时 JSON 结构可能已损坏
        content = _fix_broken_json_quotes(content)
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e2:
            print(f"修复后仍解析失败: {e2}")
            print("使用文本模式直接替换，结果可能不完美...")
            new_content = replace_halfwidth_quotes(content)
            backup = filepath + '.bak'
            with open(backup, 'w', encoding='utf-8') as f:
                f.write(content)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"已保存，原始文件备份至 {backup}")
            return

    # 递归处理所有字符串值
    data = process_json_values(data)

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"已处理: {filepath}")


def _fix_broken_json_quotes(content: str) -> str:
    """
    修复因半角引号导致的 JSON 解析错误。
    策略：在 JSON 字符串值内部，将中文语境下的半角引号替换为全角。
    """
    # 匹配 JSON 的字符串值：在 "key": "value" 或 "value" 中的 value 部分
    # 使用更简单的方法：找到所有中文字符附近的 " 并替换
    result = []
    i = 0
    in_string = False
    escape_next = False

    while i < len(content):
        ch = content[i]

        if escape_next:
            result.append(ch)
            escape_next = False
            i += 1
            continue

        if ch == '\\':
            result.append(ch)
            escape_next = True
            i += 1
            continue

        if ch == '"' and not in_string:
            # JSON 结构引号，进入字符串
            result.append(ch)
            in_string = True
            i += 1
            continue

        if ch == '"' and in_string:
            # 可能是字符串结束引号，检查后面是不是 JSON 结构字符
            # 如果后面是 : , } ] 或空白后跟这些，则是结构引号
            rest = content[i + 1:]
            m = re.match(r'\s*[:,\}\]]', rest)
            if m:
                # 是 JSON 结构引号，结束字符串
                result.append(ch)
                in_string = False
            else:
                # 是字符串内容中的引号，替换为全角
                prev_char = content[i - 1] if i > 0 else ''
                next_char = content[i + 1] if i + 1 < len(content) else ''
                if _is_chinese_context(prev_char, next_char):
                    # 判断是左引号还是右引号
                    if _is_chinese_or_punct(next_char) and not _is_chinese_or_punct(prev_char):
                        result.append('\u201c')  # 左引号
                    elif _is_chinese_or_punct(prev_char) and not _is_chinese_or_punct(next_char):
                        result.append('\u201d')  # 右引号
                    else:
                        # 无法判断，默认为右引号
                        result.append('\u201d')
                else:
                    result.append(ch)
            i += 1
            continue

        result.append(ch)
        i += 1

    return ''.join(result)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python fix_quotes.py <文件路径>")
        print("示例: python fix_quotes.py prisma/seed-chinese.json")
        print("      python fix_quotes.py prisma/seed-chinese.ts")
        sys.exit(1)

    filepath = sys.argv[1]

    if filepath.endswith('.json'):
        process_json_file(filepath)
    elif filepath.endswith('.ts'):
        process_ts_file(filepath)
    else:
        print(f"不支持的文件类型: {filepath}")
        print("支持 .json 和 .ts 文件")
        sys.exit(1)