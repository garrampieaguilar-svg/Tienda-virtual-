import type { Settings } from "@/types/database";

/** Pie de página: datos del comercio, sin adornos. */
export function Footer({ settings }: { settings: Settings }) {
  const whatsapp = settings.whatsapp_phone?.replace(/\D/g, "");
  return (
    <footer className="mt-16 border-t border-neutral-200">
      <div className="mx-auto max-w-content space-y-1 px-4 py-8 text-sm text-neutral-600">
        <p className="font-medium text-neutral-900">{settings.store_name}</p>
        {settings.store_address && <p>{settings.store_address}</p>}
        {settings.opening_hours && <p>{settings.opening_hours}</p>}
        {whatsapp && (
          <p>
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded text-accent underline underline-offset-2"
            >
              Escribinos por WhatsApp
            </a>
          </p>
        )}
      </div>
    </footer>
  );
}
