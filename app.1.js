const state = { data: null, range: 'all' };

// 时间范围筛选：全部 / 上半年 / 近三个月（按 months 下标切片）
const RANGES = {
  all: [0, 8],
  firstHalf: [0, 6],
  recent3: [5, 8]
};

// 根据当前选中的时间范围，从完整数据中切出子集（卡片与两张图共用）
const getFilteredData = () => {
  const [start, end] = RANGES[state.range];
  const months = state.data.months.slice(start, end);
  const series = state.data.series.map(s => ({
    category: s.category,
    counts: s.counts.slice(start, end)
  }));
  return { months, series, unit: state.data.unit };
};

// 按月汇总各品类支出，得到每月总支出
const monthlyTotals = (series, months) =>
  months.map((_, i) => series.reduce((sum, s) => sum + s.counts[i], 0));

const showStatus = (message, showRetry) => {
  $('#status-text').text(message);
  $('#retry-btn').toggle(showRetry === true);
  $('#status').addClass('is-visible');
  $('#dashboard').removeClass('is-visible');
};

const hideStatus = () => {
  $('#status').removeClass('is-visible');
  $('#dashboard').addClass('is-visible');
};

const loadData = async (url) => {
  showStatus('加载中...', false);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    const data = await response.json();
    if (!data.series || data.series.length === 0) {
      showStatus('暂无数据（当前时间段内没有记账记录）', false);
      return;
    }
    state.data = data;
    $('#sub-title').text(data.title + ' · 数据来源：' + data.source);
    hideStatus();
    renderAll();
  } catch (error) {
    showStatus('加载失败：' + error.message + '（可点击右侧按钮重试）', true);
  }
};

const renderCards = ({ months, series }) => {
  const totals = monthlyTotals(series, months);
  const grandTotal = totals.reduce((sum, n) => sum + n, 0);
  const average = Math.round(grandTotal / months.length);
  const maxIndex = totals.indexOf(Math.max(...totals));

  const cards = [
    { label: '总支出', value: grandTotal + ' 元', hint: '所选 ' + months.length + ' 个月累计' },
    { label: '月均支出', value: average + ' 元', hint: '总支出 ÷ 记账月数' },
    { label: '支出最高月份', value: months[maxIndex], hint: '当月支出 ' + totals[maxIndex] + ' 元' },
    { label: '记账月数', value: months.length + ' 个月', hint: '共 ' + series.length + ' 个支出分类' }
  ];

  $('#cards').empty().append(cards.map(c => `
    <div class="col-6 col-md-3">
      <div class="card stat-card h-100">
        <div class="card-body">
          <h3 class="card-title h6">${c.label}</h3>
          <p class="card-text fs-4 mb-1">${c.value}</p>
          <p class="card-text small text-muted mb-0">${c.hint}</p>
        </div>
      </div>
    </div>
  `).join(''));
};

let barChart = null;

const renderBarChart = ({ months, series, unit }) => {
  if (barChart === null) {
    barChart = echarts.init(document.querySelector('#bar-chart'));
  }
  barChart.setOption({
    title: { text: '各月各分类支出（单位：' + unit + '）', left: 'center' },
    tooltip: {
      trigger: 'axis',
      valueFormatter: value => value + ' ' + unit
    },
    legend: { bottom: 0 },
    grid: { left: 60, right: 20, top: 50, bottom: 50 },
    xAxis: { type: 'category', data: months },
    yAxis: { type: 'value', name: unit, beginAtZero: true },
    series: series.map(s => ({
      name: s.category,
      type: 'bar',
      data: s.counts
    }))
  }, true);
};

let lineChart = null;

const renderLineChart = ({ months, series, unit }) => {
  const totals = monthlyTotals(series, months);
  const config = {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: '月度总支出',
        data: totals,
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13,110,253,0.15)',
        borderWidth: 2,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        title: { display: true, text: '月度总支出趋势（单位：' + unit + '）' },
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: item => item.dataset.label + '：' + item.parsed.y + ' ' + unit
          }
        }
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: unit } }
      }
    }
  };
  if (lineChart === null) {
    lineChart = new Chart(document.querySelector('#line-chart'), config);
  } else {
    lineChart.data = config.data;
    lineChart.update();
  }
};

const renderAll = () => {
  const filtered = getFilteredData();
  renderCards(filtered);
  renderBarChart(filtered);
  renderLineChart(filtered);
};


// 窗口拉伸：ECharts 需手动 resize；Chart.js 设置 maintainAspectRatio:false 后自动适配
window.addEventListener('resize', () => {
  if (barChart !== null) {
    barChart.resize();
  }
});

// 通过 ?state=empty / ?state=error 演示空数据与失败状态
const demoState = new URLSearchParams(window.location.search).get('state');
let initialUrl = 'data.1/expenses.json';
if (demoState === 'empty') {
  initialUrl = 'data.1/expenses-empty.json';
} else if (demoState === 'error') {
  initialUrl = 'data.1/not-exist.json';
}
loadData(initialUrl);
