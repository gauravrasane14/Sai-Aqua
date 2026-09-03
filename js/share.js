/* ================================================================
   SAI AQUA — Sharing Engine
   Web Share API for native mobile sharing + download fallbacks
   ================================================================ */

const Share = (() => {

  // ── Check if Web Share API supports file sharing ───────────────
  function canShareFiles() {
    return navigator.share && navigator.canShare;
  }

  // ── Share PDF via native share sheet ───────────────────────────
  async function sharePDF(pdfBlob, invoiceNumber) {
    const fileName = `SaiAqua_Invoice_${invoiceNumber}.pdf`;
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    if (canShareFiles() && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Invoice ${invoiceNumber}`,
          text: `Invoice ${invoiceNumber} from Sai Aqua`
        });
        Utils.showToast('Shared successfully!', 'success');
        return true;
      } catch (err) {
        if (err.name === 'AbortError') {
          // User cancelled — not an error
          return false;
        }
        console.warn('Share failed, falling back to download:', err);
        downloadBlob(pdfBlob, fileName);
        Utils.showToast('Downloaded — share manually', 'info');
        return false;
      }
    } else {
      // Fallback: download
      downloadBlob(pdfBlob, fileName);
      Utils.showToast('PDF downloaded', 'success');
      return false;
    }
  }

  // ── Share Image via native share sheet ─────────────────────────
  async function shareImage(pngBlob, invoiceNumber) {
    const fileName = `SaiAqua_Invoice_${invoiceNumber}.png`;
    const file = new File([pngBlob], fileName, { type: 'image/png' });

    if (canShareFiles() && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Invoice ${invoiceNumber}`,
          text: `Invoice ${invoiceNumber} from Sai Aqua`
        });
        Utils.showToast('Shared successfully!', 'success');
        return true;
      } catch (err) {
        if (err.name === 'AbortError') {
          return false;
        }
        console.warn('Share failed, falling back to download:', err);
        downloadBlob(pngBlob, fileName);
        Utils.showToast('Downloaded — share manually', 'info');
        return false;
      }
    } else {
      // Fallback: download
      downloadBlob(pngBlob, fileName);
      Utils.showToast('Image downloaded', 'success');
      return false;
    }
  }

  // ── Download PDF ───────────────────────────────────────────────
  function downloadPDF(pdfBlob, invoiceNumber) {
    const fileName = `SaiAqua_Invoice_${invoiceNumber}.pdf`;
    downloadBlob(pdfBlob, fileName);
    Utils.showToast('PDF downloaded', 'success');
  }

  // ── Save Image (download) ─────────────────────────────────────
  function saveImage(pngBlob, invoiceNumber) {
    const fileName = `SaiAqua_Invoice_${invoiceNumber}.png`;
    downloadBlob(pngBlob, fileName);
    Utils.showToast('Image saved', 'success');
  }

  // ── Print Invoice ──────────────────────────────────────────────
  function printInvoice(invoiceCanvasElement) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      Utils.showToast('Please allow popups to print', 'error');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Invoice</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          body { margin: 0; padding: 20px; font-family: 'Inter', sans-serif; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${invoiceCanvasElement.outerHTML}
        <script>
          setTimeout(() => { window.print(); window.close(); }, 500);
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  // ── Internal: Download Blob ────────────────────────────────────
  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    canShareFiles,
    sharePDF,
    shareImage,
    downloadPDF,
    saveImage,
    printInvoice
  };
})();
