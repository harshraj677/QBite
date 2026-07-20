'use client';

import { Check, ChevronsUpDown, User } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useKnownStudents } from '../hooks/use-known-students';

interface StudentComboboxProps {
  value?: string;
  onChange: (studentId: string | undefined) => void;
}

/** Searches only students seen in recent orders (see useKnownStudents's doc comment for why — there's no student-directory endpoint) — the trigger label makes that scope explicit rather than implying a full roster. */
export function StudentCombobox({ value, onChange }: StudentComboboxProps) {
  const [open, setOpen] = useState(false);
  const { students, isPending } = useKnownStudents();
  const selected = students.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              <User className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{selected ? selected.fullName : 'Any student'}</span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search recent students…" />
          <CommandList>
            <CommandEmpty>{isPending ? 'Loading…' : 'No matching students found.'}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__any__"
                onSelect={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                <Check className={cn('opacity-0', !value && 'opacity-100')} />
                Any student
              </CommandItem>
              {students.map((student) => (
                <CommandItem
                  key={student.id}
                  value={`${student.fullName} ${student.collegeEmail}`}
                  onSelect={() => {
                    onChange(student.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('opacity-0', value === student.id && 'opacity-100')} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{student.fullName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {student.collegeEmail}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
