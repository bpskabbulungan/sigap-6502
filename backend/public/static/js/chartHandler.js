let chartInstance = null;

function parseLabelDate(value) {
  if (typeof value !== "string") return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;

  if (parts[0].length === 2) {
    const [day, month, year] = parts.map(Number);
    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return null;
    return new Date(Date.UTC(year, month - 1, day));
  }

  if (parts[0].length === 4) {
    const [year, month, day] = parts.map(Number);
    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return null;
    return new Date(Date.UTC(year, month - 1, day));
  }

  return null;
}

function sortLabels(a, b) {
  const left = parseLabelDate(a);
  const right = parseLabelDate(b);
  if (left && right) return left - right;
  if (left) return -1;
  if (right) return 1;
  return String(a).localeCompare(String(b));
}

export async function renderCharts() {
  try {
    const res = await fetch("/stats");
    const data = await res.json();

    const {
      messagesPerDay = {},
      errorsPerDay = {},
      uptimePerDay = {},
    } = data || {};

    const labels = Array.from(
      new Set([
        ...Object.keys(messagesPerDay),
        ...Object.keys(errorsPerDay),
        ...Object.keys(uptimePerDay),
      ])
    ).sort(sortLabels);

    const messages = labels.map((d) => messagesPerDay[d] || 0);
    const errors = labels.map((d) => errorsPerDay[d] || 0);
    const uptime = labels.map((d) => uptimePerDay[d] || 0);

    const isDark = document.body.classList.contains("dark");
    const gridColor = isDark ? "#4b5563" : "#e5e7eb";
    const textColor = isDark ? "#f3f4f6" : "#1f2937";
    const tooltipBg = isDark ? "#1f2937" : "#ffffff";

    const canvas = document.getElementById("messagesChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (chartInstance) {
      chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Pesan Terkirim",
            data: messages,
            borderColor: "#22c55e",
            fill: false,
          },
          {
            label: "Error",
            data: errors,
            borderColor: "#ef4444",
            fill: false,
          },
          {
            label: "Uptime Log (💓)",
            data: uptime,
            borderColor: "#3b82f6",
            fill: false,
          },
        ],
      },
      options: {
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor },
          },
          y: {
            grid: { color: gridColor },
            ticks: { color: textColor },
          },
        },
        plugins: {
          legend: {
            labels: { color: textColor },
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: textColor,
            bodyColor: textColor,
          },
        },
      },
    });
  } catch (e) {
    console.error("[Chart] Gagal render chart:", e);
  }
}
