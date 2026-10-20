import { PRESETS } from "@/data/presets";
import { cn } from "@/lib/utils";
import { LayoutList, Users } from "lucide-react";

interface TaskSelectorProps {
    onSelect: (agents: string[]) => void;
    className?: string;
}

export function TaskSelector({ onSelect, className }: TaskSelectorProps) {
    return (
        <div className={cn("flex flex-col h-full border-r border-l border-primary/10 bg-card/30 backdrop-blur-sm w-64", className)}>
            <div className="flex items-center justify-between p-3.5 border-b border-primary/10 bg-muted/20">
                <div className="flex items-center gap-2">
                    <LayoutList className="h-4 w-4 text-primary" />
                    <span className="font-bold text-xs uppercase tracking-wider text-primary">Tareas Predefinidas</span>
                </div>
                <span className="text-[10px] text-muted-foreground bg-primary/10 px-1.5 py-0.5 rounded">{PRESETS.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                {PRESETS.map((preset, idx) => (
                    <button
                        key={idx}
                        onClick={() => onSelect(preset.agents)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all text-left group"
                        title={preset.description}
                    >
                        <div className="p-1.5 rounded-md bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                            <preset.icon size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-medium text-xs truncate text-foreground group-hover:text-primary transition-colors">{preset.title}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                                <Users className="h-2.5 w-2.5 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground">{preset.agents.length} agentes</span>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
