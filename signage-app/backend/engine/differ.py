"""
差异对比引擎模块
按key_field匹配两表行，返回新增/删除/修改/不变四类
"""
from typing import List, Dict, Any, Optional, Tuple


class ListDiffer:
    """清单差异对比引擎类"""

    def compare(
        self,
        list_a: List[List[Any]],
        list_b: List[List[Any]],
        headers_a: List[str],
        headers_b: List[str],
        key_field: str = "编号"
    ) -> Dict[str, Any]:
        """
        按key_field匹配两表行。
        返回四类：added(新增)/removed(删除)/modified(修改)/unchanged(不变)
        修改项标注 changed_fields

        Args:
            list_a: 旧版清单数据行
            list_b: 新版清单数据行
            headers_a: 旧版清单列名
            headers_b: 新版清单列名
            key_field: 用于匹配的主键字段名

        Returns:
            差异对比结果字典
        """
        # 找到key_field在两个表中的列索引
        key_idx_a = self._find_column_index(headers_a, key_field)
        key_idx_b = self._find_column_index(headers_b, key_field)

        # 构建旧版数据字典：key -> {row_data, row_dict}
        old_data = {}
        for row in list_a:
            key_val = self._get_cell_value(row, key_idx_a)
            if key_val is not None and str(key_val).strip():
                row_dict = self._row_to_dict(row, headers_a)
                old_data[str(key_val).strip()] = {"row": row, "dict": row_dict}

        # 构建新版数据字典
        new_data = {}
        for row in list_b:
            key_val = self._get_cell_value(row, key_idx_b)
            if key_val is not None and str(key_val).strip():
                row_dict = self._row_to_dict(row, headers_b)
                new_data[str(key_val).strip()] = {"row": row, "dict": row_dict}

        added = []       # 新版有、旧版无
        removed = []     # 旧版有、新版无
        modified = []    # 两边都有但内容不同
        unchanged = []   # 两边完全一致

        # 检查新增和修改
        for key_val, new_item in new_data.items():
            if key_val not in old_data:
                # 新增
                added.append({
                    "key": key_val,
                    "data": new_item["dict"]
                })
            else:
                # 两边都有，检查是否有修改
                old_item = old_data[key_val]
                changed_fields = self._compare_rows(old_item["dict"], new_item["dict"], headers_a, headers_b)
                if changed_fields:
                    modified.append({
                        "key": key_val,
                        "old_data": old_item["dict"],
                        "new_data": new_item["dict"],
                        "changed_fields": changed_fields
                    })
                else:
                    unchanged.append({
                        "key": key_val,
                        "data": new_item["dict"]
                    })

        # 检查删除
        for key_val, old_item in old_data.items():
            if key_val not in new_data:
                removed.append({
                    "key": key_val,
                    "data": old_item["dict"]
                })

        # 生成汇总
        summary = {
            "total_old": len(list_a),
            "total_new": len(list_b),
            "added_count": len(added),
            "removed_count": len(removed),
            "modified_count": len(modified),
            "unchanged_count": len(unchanged),
            "key_field": key_field
        }

        return {
            "added": added,
            "removed": removed,
            "modified": modified,
            "unchanged": unchanged,
            "summary": summary
        }

    def _find_column_index(self, headers: List[str], column_name: str) -> int:
        """
        查找列名在headers中的索引（模糊匹配）

        Args:
            headers: 列名列表
            column_name: 要查找的列名

        Returns:
            列索引，未找到返回-1
        """
        column_name_lower = column_name.lower().strip()
        for i, header in enumerate(headers):
            if header.lower().strip() == column_name_lower:
                return i
        # 模糊匹配：包含关系
        for i, header in enumerate(headers):
            if column_name_lower in header.lower() or header.lower() in column_name_lower:
                return i
        return -1

    def _get_cell_value(self, row: List[Any], idx: int) -> Any:
        """安全获取行中指定列的值"""
        if idx < 0 or idx >= len(row):
            return None
        return row[idx]

    def _row_to_dict(self, row: List[Any], headers: List[str]) -> Dict[str, Any]:
        """将行数据转为字典，列名->值"""
        result = {}
        for i, header in enumerate(headers):
            if i < len(row):
                val = row[i]
                # 统一转为字符串以便比较
                result[header] = str(val).strip() if val is not None else ""
            else:
                result[header] = ""
        return result

    def _compare_rows(
        self,
        old_row: Dict[str, Any],
        new_row: Dict[str, Any],
        headers_a: List[str],
        headers_b: List[str]
    ) -> List[Dict[str, str]]:
        """
        比较两行数据，找出变化的字段

        Args:
            old_row: 旧行字典
            new_row: 新行字典
            headers_a: 旧版列名
            headers_b: 新版列名

        Returns:
            变化字段列表
        """
        changed_fields = []

        # 合并所有列名
        all_headers = list(dict.fromkeys(headers_a + headers_b))

        for header in all_headers:
            old_val = old_row.get(header, "")
            new_val = new_row.get(header, "")
            if old_val != new_val:
                changed_fields.append({
                    "field": header,
                    "old_value": old_val,
                    "new_value": new_val
                })

        return changed_fields
