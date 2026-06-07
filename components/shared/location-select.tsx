"use client";

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UZBEKISTAN_REGIONS, getDistricts } from "@/lib/uzbekistan";
import { Label } from "@/components/ui/label";

interface LocationSelectProps {
  value?: string; // "Toshkent shahri, Chilonzor" format
  onChange: (value: string) => void;
}

export function LocationSelect({ value, onChange }: LocationSelectProps) {
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");

  // Parse initial value
  useEffect(() => {
    if (value) {
      const parts = value.split(", ");
      if (parts.length === 2) {
        setRegion(parts[0]);
        setDistrict(parts[1]);
      } else if (parts.length === 1) {
        setRegion(parts[0]);
      }
    }
  }, []);

  function handleRegionChange(r: string) {
    setRegion(r);
    setDistrict("");
    onChange(r);
  }

  function handleDistrictChange(d: string) {
    setDistrict(d);
    onChange(`${region}, ${d}`);
  }

  const districts = getDistricts(region);

  return (
    <div className="space-y-2">
      <Label>Manzil</Label>
      <div className="grid grid-cols-2 gap-2">
        <Select value={region} onValueChange={handleRegionChange}>
          <SelectTrigger>
            <SelectValue placeholder="Viloyat tanlang" />
          </SelectTrigger>
          <SelectContent>
            {UZBEKISTAN_REGIONS.map((r) => (
              <SelectItem key={r.name} value={r.name}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={district} onValueChange={handleDistrictChange} disabled={!region}>
          <SelectTrigger>
            <SelectValue placeholder={region ? "Tuman tanlang" : "Avval viloyat"} />
          </SelectTrigger>
          <SelectContent>
            {districts.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
