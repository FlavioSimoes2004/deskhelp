import { useEffect, useRef, useState } from "react";
import { ApiError } from "../services/api";
import { ticketService } from "../services/deskhelp";
import type { TicketAttachment } from "../services/types";
import { formatBytes } from "../utils/format";
import { ErrorAlert, Loading } from "./Feedback";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

/** Anexos que abrem em pré-visualização em vez de baixar (pela extensão do nome). */
export const isImageAttachment = (attachment: TicketAttachment) =>
  IMAGE_EXTENSIONS.some((ext) => attachment.originalName.toLowerCase().endsWith(ext));

/**
 * Janela com a imagem do anexo. O arquivo exige o token, então é baixado pela API e
 * exibido a partir da memória (blob:). Esc, "Fechar" ou clique fora fecham.
 */
export function ImagePreview({ attachment, onClose }: { attachment: TicketAttachment; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    ticketService
      .attachmentBlob(attachment)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => !cancelled && setError(err as ApiError));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment]);

  async function onDownload() {
    setDownloading(true);
    try {
      await ticketService.downloadAttachment(attachment);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="image-preview"
      aria-label={`Pré-visualização de ${attachment.originalName}`}
      onClose={onClose}
      // Clique no fundo escurecido (fora do conteúdo) fecha a janela.
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
    >
      <div className="image-preview-body">
        <div className="image-preview-head">
          <strong title={attachment.originalName}>{attachment.originalName}</strong>
          <span className="muted">{formatBytes(attachment.sizeBytes)}</span>
        </div>
        <div className="image-preview-frame">
          {error ? (
            <ErrorAlert error={error} />
          ) : url ? (
            <img src={url} alt={attachment.originalName} />
          ) : (
            <Loading label="Carregando imagem…" />
          )}
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onDownload} disabled={downloading}>
            {downloading ? "Baixando…" : "Baixar"}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => dialog.current?.close()} autoFocus>
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  );
}
