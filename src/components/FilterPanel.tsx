"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export interface FilterState {
  questionType: string;
  source: string;
  year: string;
  tag: string;
}

interface FilterPanelProps {
  questionTypes: string[];
  sources: string[];
  years: string[];
  tags: string[];
  selectedFilters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClearFilters: () => void;
}

export function FilterPanel({
  questionTypes,
  sources,
  years,
  tags,
  selectedFilters,
  onFilterChange,
  onClearFilters,
}: FilterPanelProps) {
  const hasActiveFilters = Object.values(selectedFilters).some(v => v !== '');

  return (
    <div className="space-y-6">
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mb-2"
          onClick={onClearFilters}
        >
          清除所有筛选
        </Button>
      )}

      {/* 题型筛选 */}
      <div>
        <Label className="text-sm font-medium text-muted-foreground mb-3 block">题型</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            key="all"
            variant={selectedFilters.questionType === '' ? "default" : "outline"}
            size="sm"
            className="px-3 py-1 text-xs"
            onClick={() => onFilterChange({ ...selectedFilters, questionType: '' })}
          >
            全部
          </Button>
          {questionTypes.map((type) => (
            <Button
              key={type}
              variant={selectedFilters.questionType === type ? "default" : "outline"}
              size="sm"
              className="px-3 py-1 text-xs"
              onClick={() => onFilterChange({ ...selectedFilters, questionType: type })}
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      {/* 来源筛选 */}
      <div>
        <Label className="text-sm font-medium text-muted-foreground mb-3 block">来源</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            key="all"
            variant={selectedFilters.source === '' ? "default" : "outline"}
            size="sm"
            className="px-3 py-1 text-xs"
            onClick={() => onFilterChange({ ...selectedFilters, source: '' })}
          >
            全部
          </Button>
          {sources.map((source) => (
            <Button
              key={source}
              variant={selectedFilters.source === source ? "default" : "outline"}
              size="sm"
              className="px-3 py-1 text-xs"
              onClick={() => onFilterChange({ ...selectedFilters, source })}
            >
              {source}
            </Button>
          ))}
        </div>
      </div>

      {/* 年份筛选 */}
      <div>
        <Label className="text-sm font-medium text-muted-foreground mb-3 block">年份</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            key="all"
            variant={selectedFilters.year === '' ? "default" : "outline"}
            size="sm"
            className="px-3 py-1 text-xs"
            onClick={() => onFilterChange({ ...selectedFilters, year: '' })}
          >
            全部
          </Button>
          {years.map((year) => (
            <Button
              key={year}
              variant={selectedFilters.year === year ? "default" : "outline"}
              size="sm"
              className="px-3 py-1 text-xs"
              onClick={() => onFilterChange({ ...selectedFilters, year })}
            >
              {year}年
            </Button>
          ))}
        </div>
      </div>

      {/* 标签筛选（包含年级） */}
      <div>
        <Label className="text-sm font-medium text-muted-foreground mb-3 block">标签</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            key="all"
            variant={selectedFilters.tag === '' ? "default" : "outline"}
            size="sm"
            className="px-3 py-1 text-xs"
            onClick={() => onFilterChange({ ...selectedFilters, tag: '' })}
          >
            全部
          </Button>
          {tags.slice(0, 10).map((tag) => (
            <Button
              key={tag}
              variant={selectedFilters.tag === tag ? "default" : "outline"}
              size="sm"
              className="px-3 py-1 text-xs"
              onClick={() => onFilterChange({ ...selectedFilters, tag })}
            >
              {tag}
            </Button>
          ))}
          {tags.length > 10 && (
            <Button variant="outline" size="sm" className="px-3 py-1 text-xs">
              +{tags.length - 10}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
