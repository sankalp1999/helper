import { MessageSquareText as SavedReplyIcon, ChevronDown, Search } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { stripHtmlTags } from "@/components/utils/html";
import { cn } from "@/lib/utils";
import { RouterOutputs } from "@/trpc";

type SavedReply = RouterOutputs["mailbox"]["savedReplies"]["list"][number];

interface SavedReplySelectorProps {
  savedReplies: SavedReply[];
  onSelect: (savedReply: { slug: string; content: string; name: string }) => void;
}

export function SavedReplySelector({ savedReplies, onSelect }: SavedReplySelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Filter saved replies based on search
  const filteredReplies = savedReplies.filter(
    (reply) =>
      reply.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      stripHtmlTags(reply.content).toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleSelect = (savedReply: SavedReply) => {
    onSelect({
      slug: savedReply.slug,
      content: savedReply.content,
      name: savedReply.name,
    });
    setOpen(false);
    setSearchValue("");
  };

  // Reset search when popover closes
  useEffect(() => {
    if (!open) {
      setSearchValue("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={buttonRef}
          variant="outlined_subtle"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-left font-normal"
        >
          <span className="flex items-center gap-2">
            <SavedReplyIcon className="h-4 w-4" />
            <span>Insert saved reply</span>
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-full p-0"
        align="start"
        style={{ width: buttonRef.current?.offsetWidth }}
      >
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Search saved replies..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList>
            <CommandEmpty>No saved replies found.</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-y-auto">
              {filteredReplies.map((savedReply) => (
                <CommandItem
                  key={savedReply.slug}
                  value={savedReply.slug}
                  onSelect={() => handleSelect(savedReply)}
                  className="flex flex-col items-start gap-1 py-3 cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">{savedReply.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Used {savedReply.usageCount} times
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground line-clamp-2">
                    {stripHtmlTags(savedReply.content)}
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