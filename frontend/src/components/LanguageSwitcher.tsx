import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supportedLocales, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
}

const LanguageSwitcher = ({ className }: LanguageSwitcherProps) => {
  const { locale, setLocale } = useI18n();
  return (
    <Select value={locale} onValueChange={(v) => setLocale(v as any)}>
      <SelectTrigger className={cn("w-[140px]", className)}>
        <SelectValue placeholder="Language" />
      </SelectTrigger>
      <SelectContent>
        {supportedLocales.map(l => (
          <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default LanguageSwitcher;



