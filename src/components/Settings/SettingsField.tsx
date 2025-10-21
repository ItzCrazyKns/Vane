import {
  SelectUIConfigField,
  StringUIConfigField,
  TextareaUIConfigField,
  UIConfigField,
} from '@/lib/config/types';
import { useState } from 'react';
import Select from '../ui/Select';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { Loader2 } from 'lucide-react';

const SettingsSelect = ({
  field,
  value,
  setValue,
  dataAdd,
}: {
  field: SelectUIConfigField;
  value?: any;
  setValue: (value: any) => void;
  dataAdd: string;
}) => {
  const [loading, setLoading] = useState(false);
  const { setTheme } = useTheme();

  const handleSave = async (newValue: any) => {
    setLoading(true);
    setValue(newValue);
    try {
      if (field.scope === 'client') {
        localStorage.setItem(field.key, newValue);
        if (field.key === 'theme') {
          setTheme(newValue);
        }
      } else {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: `${dataAdd}.${field.key}`,
            value: newValue,
          }),
        });

        if (!res.ok) {
          console.error('Failed to save config:', await res.text());
          throw new Error('Failed to save configuration');
        }
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration.');
    } finally {
      setTimeout(() => setLoading(false), 150);
    }
  };

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div>
          <h4 className="text-sm lg:text-base text-black dark:text-white">
            {field.name}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {field.description}
          </p>
        </div>
        <Select
          value={value}
          onChange={(event) => handleSave(event.target.value)}
          options={field.options.map((option) => ({
            value: option.value,
            label: option.name,
          }))}
          className="!text-xs lg:!text-sm"
          loading={loading}
          disabled={loading}
        />
      </div>
    </section>
  );
};

const SettingsInput = ({
  field,
  value,
  setValue,
  dataAdd,
}: {
  field: StringUIConfigField;
  value?: any;
  setValue: (value: any) => void;
  dataAdd: string;
}) => {
  const [loading, setLoading] = useState(false);

  const handleSave = async (newValue: any) => {
    setLoading(true);
    setValue(newValue);
    try {
      if (field.scope === 'client') {
        localStorage.setItem(field.key, newValue);
      } else {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: `${dataAdd}.${field.key}`,
            value: newValue,
          }),
        });

        if (!res.ok) {
          console.error('Failed to save config:', await res.text());
          throw new Error('Failed to save configuration');
        }
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration.');
    } finally {
      setTimeout(() => setLoading(false), 150);
    }
  };

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div>
          <h4 className="text-sm lg:text-base text-black dark:text-white">
            {field.name}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {field.description}
          </p>
        </div>
        <div className="relative">
          <input
            value={value ?? field.default ?? ''}
            onChange={(event) => setValue(event.target.value)}
            onBlur={(event) => handleSave(event.target.value)}
            className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-3 py-2 lg:px-4 lg:py-3 pr-10 !text-xs lg:!text-sm text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus-visible:outline-none focus-visible:border-light-300 dark:focus-visible:border-dark-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            placeholder={field.placeholder}
            type="text"
            disabled={loading}
          />
          {loading && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
          )}
        </div>
      </div>
    </section>
  );
};

const SettingsTextarea = ({
  field,
  value,
  setValue,
  dataAdd,
}: {
  field: TextareaUIConfigField;
  value?: any;
  setValue: (value: any) => void;
  dataAdd: string;
}) => {
  const [loading, setLoading] = useState(false);

  const handleSave = async (newValue: any) => {
    setLoading(true);
    setValue(newValue);
    try {
      if (field.scope === 'client') {
        localStorage.setItem(field.key, newValue);
      } else {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: `${dataAdd}.${field.key}`,
            value: newValue,
          }),
        });

        if (!res.ok) {
          console.error('Failed to save config:', await res.text());
          throw new Error('Failed to save configuration');
        }
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration.');
    } finally {
      setTimeout(() => setLoading(false), 150);
    }
  };

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div>
          <h4 className="text-sm lg:text-base text-black dark:text-white">
            {field.name}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {field.description}
          </p>
        </div>
        <div className="relative">
          <textarea
            value={value ?? field.default ?? ''}
            onChange={(event) => setValue(event.target.value)}
            onBlur={(event) => handleSave(event.target.value)}
            className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-3 py-2 lg:px-4 lg:py-3 pr-10 !text-xs lg:!text-sm text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus-visible:outline-none focus-visible:border-light-300 dark:focus-visible:border-dark-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            placeholder={field.placeholder}
            rows={4}
            disabled={loading}
          />
          {loading && (
            <span className="pointer-events-none absolute right-3 translate-y-3 text-black/40 dark:text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
          )}
        </div>
      </div>
    </section>
  );
};

const SettingsField = ({
  field,
  value,
  dataAdd,
}: {
  field: UIConfigField;
  value: any;
  dataAdd: string;
}) => {
  const [val, setVal] = useState(value);

  switch (field.type) {
    case 'select':
      return (
        <SettingsSelect
          field={field}
          value={val}
          setValue={setVal}
          dataAdd={dataAdd}
        />
      );
    case 'string':
      return (
        <SettingsInput
          field={field}
          value={val}
          setValue={setVal}
          dataAdd={dataAdd}
        />
      );
    case 'textarea':
      return (
        <SettingsTextarea
          field={field}
          value={val}
          setValue={setVal}
          dataAdd={dataAdd}
        />
      );
    default:
      return <div>Unsupported field type: {field.type}</div>;
  }
};

export default SettingsField;
