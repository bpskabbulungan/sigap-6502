document.addEventListener("DOMContentLoaded", () => {
  const previewBox = document.getElementById("templatePreview");
  const textarea = document.getElementById("templateEditor");
  const editBtn = document.getElementById("editTemplateBtn");
  const saveBtn = document.getElementById("saveTemplateBtn");
  const cancelBtn = document.getElementById("cancelTemplateBtn");
  const formSection = document.getElementById("formSection");
  const previewSection = document.getElementById("previewSection");
  const messageBox = document.getElementById("statusMessage");

  if (!previewBox || !textarea || !editBtn || !saveBtn || !cancelBtn) return;

  editBtn.addEventListener("click", () => {
    formSection.classList.remove("hidden");
    previewSection.classList.add("hidden");
    messageBox.classList.add("hidden");
    textarea.value = previewBox.textContent.trim();
  });

  cancelBtn.addEventListener("click", async () => {
    const result = await Swal.fire({
      title: "Batalkan perubahan?",
      text: "Semua perubahan yang belum disimpan akan hilang.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, batalkan",
      cancelButtonText: "Kembali",
    });

    if (!result.isConfirmed) return;

    formSection.classList.add("hidden");
    previewSection.classList.remove("hidden");
    messageBox.classList.add("hidden");
  });

  saveBtn.addEventListener("click", async () => {
    const confirm = await Swal.fire({
      title: "Simpan Perubahan?",
      text: "Templat akan diperbarui.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, simpan",
      cancelButtonText: "Batal",
    });

    if (!confirm.isConfirmed) return;

    const newTemplate = textarea.value.trim();

    try {
      const res = await fetch("/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: newTemplate }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menyimpan.");

      previewBox.textContent = newTemplate;

      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: "Templat berhasil disimpan.",
        timer: 1500,
        showConfirmButton: false,
      });

      formSection.classList.add("hidden");
      previewSection.classList.remove("hidden");
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: err.message || "Terjadi kesalahan saat menyimpan.",
      });
    }
  });
});
