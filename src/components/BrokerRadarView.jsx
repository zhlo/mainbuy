import React, { useState, useMemo } from 'react';
import { BROKER_LIST, computePeriodChipAnalysis, computeStockMomentum } from '../data/mockStocks';

export default function BrokerRadarView({ stocks, onSelectStockWithBroker }) {
  const [selectedBrokerId, setSelectedBrokerId] = useState('kgi-taipei');
  const [periodDays, setPeriodDays] = useState(1);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | '神秘' | '外資' | '隔日沖' | '官股'
  const [momentumFilter, setMomentumFilter] = useState('ALL'); // 'ALL' | 'DAY1_BUY' | 'BUY_5D' | 'BUY_10D'

  // 合併內建知名分點與從真實券商日報表抓到的上榜主力分點
  const allAvailableBrokers = useMemo(() => {
    const map = new Map();
    BROKER_LIST.forEach(b => map.set(b.id, b));
    stocks.forEach(s => {
      const rep = s.realBrokerReports?.[periodDays] || s.realBrokerReports?.[1];
      if (!rep) return;
      [...(rep.buyers || []), ...(rep.sellers || [])].slice(0, 6).forEach(rb => {
        if (!map.has(rb.id)) {
          map.set(rb.id, rb);
        }
      });
    });
    return Array.from(map.values());
  }, [stocks, periodDays]);

  const filteredBrokers = useMemo(() => {
    if (filterType === '神秘') return allAvailableBrokers.filter(b => b.isMystery);
    if (filterType === '外資') return allAvailableBrokers.filter(b => b.type === '外資');
    if (filterType === '隔日沖') return allAvailableBrokers.filter(b => b.isDayTrade);
    if (filterType === '官股') return allAvailableBrokers.filter(b => b.isGov);
    return allAvailableBrokers;
  }, [allAvailableBrokers, filterType]);

  const activeBroker = useMemo(() => {
    return (
      allAvailableBrokers.find(b => b.id === selectedBrokerId) ||
      filteredBrokers[0] ||
      BROKER_LIST[0]
    );
  }, [allAvailableBrokers, filteredBrokers, selectedBrokerId]);

  // 反查該券商分點在所有個股的區間買賣超、金額與損益
  const brokerHoldingsAcrossStocks = useMemo(() => {
    return stocks
      .map(stock => {
        const endIdx = stock.kline.length - 1;
        const analysis = computePeriodChipAnalysis(stock, endIdx, periodDays);
        const rec = analysis.allBrokers.find(
          b => b.id === activeBroker.id || b.name.replace(/\s+/g, '') === activeBroker.name.replace(/\s+/g, '')
        );
        const net = rec ? rec.net : 0;
        const buy = rec ? rec.buy : 0;
        const sell = rec ? rec.sell : 0;
        const avgBuy = rec ? rec.avgBuy : stock.price;
        const avgSell = rec ? rec.avgSell : stock.price;
        const profitWan = rec ? rec.profitWan : 0;
        const netAmountWan = Math.round((net * stock.price) / 10);
        const shareOfVolPct =
          analysis.periodVol > 0
            ? Number((((buy + sell) / 2 / analysis.periodVol) * 100).toFixed(2))
            : 0;
        const mom = stock.momentum || computeStockMomentum(stock.kline || []);

        return {
          stock,
          mom,
          buy,
          sell,
          net,
          avgBuy,
          avgSell,
          profitWan,
          netAmountWan,
          shareOfVolPct,
          periodVol: analysis.periodVol
        };
      })
      .filter(item => {
        if (momentumFilter === 'DAY1_BUY') return item.mom?.main?.isDay1Buy;
        if (momentumFilter === 'BUY_5D') return item.mom?.main?.is5DBuy;
        if (momentumFilter === 'BUY_10D') return item.mom?.main?.is10DBuy;
        return true;
      })
      .sort((a, b) => Math.abs(b.netAmountWan) - Math.abs(a.netAmountWan));
  }, [stocks, activeBroker, periodDays, momentumFilter]);

  const buyList = brokerHoldingsAcrossStocks
    .filter(item => item.net > 0)
    .sort((a, b) => b.netAmountWan - a.netAmountWan);
  const sellList = brokerHoldingsAcrossStocks
    .filter(item => item.net < 0)
    .sort((a, b) => a.netAmountWan - b.netAmountWan);

  // 全市場隔日沖高佔比警戒清單
  const dayTradeAlertList = useMemo(() => {
    return stocks
      .map(stock => {
        const endIdx = stock.kline.length - 1;
        const analysis = computePeriodChipAnalysis(stock, endIdx, 1);
        const dtBrokers = analysis.dayTradeBrokers.filter(b => b.net > 0);
        const dtNetBuy = dtBrokers.reduce((sum, b) => sum + b.net, 0);
        const dtRatioPct =
          stock.volume > 0 ? Number(((dtNetBuy / stock.volume) * 100).toFixed(2)) : 0;
        return {
          stock,
          dtNetBuy,
          dtRatioPct,
          topDtBroker: dtBrokers.sort((a, b) => b.net - a.net)[0]
        };
      })
      .filter(item => item.dtNetBuy > 0)
      .sort((a, b) => b.dtRatioPct - a.dtRatioPct);
  }, [stocks]);

  return (
    <section className="broker-radar-container" id="broker-radar-view">
      {/* 頂部券商篩選與統計天數控制列 */}
      <div className="radar-top-bar">
        <div className="radar-filter-group">
          <span className="toolbar-label">分點派別：</span>
          {['ALL', '神秘', '隔日沖', '外資', '官股'].map(type => (
            <button
              key={type}
              className={`btn-radar-cat ${filterType === type ? 'active' : ''}`}
              onClick={() => {
                setFilterType(type);
                const firstMatch =
                  type === 'ALL'
                    ? allAvailableBrokers[0]
                    : allAvailableBrokers.find(b =>
                        type === '神秘'
                          ? b.isMystery
                          : type === '隔日沖'
                            ? b.isDayTrade
                            : type === '外資'
                              ? b.type === '外資'
                              : b.isGov
                      );
                if (firstMatch) setSelectedBrokerId(firstMatch.id);
              }}
            >
              {type === 'ALL' ? `全部關鍵分點 (${allAvailableBrokers.length})` : `${type}分點`}
            </button>
          ))}
        </div>

        <div className="radar-filter-group">
          <span className="toolbar-label">個股動能過濾：</span>
          {[
            { id: 'ALL', label: '全部' },
            { id: 'DAY1_BUY', label: '🔥 第1天轉買' },
            { id: 'BUY_5D', label: '📈 5天內偏買' },
            { id: 'BUY_10D', label: '🚀 10天內偏買' }
          ].map(mf => (
            <button
              key={mf.id}
              className={`btn-radar-cat ${momentumFilter === mf.id ? 'active' : ''}`}
              onClick={() => setMomentumFilter(mf.id)}
            >
              {mf.label}
            </button>
          ))}
        </div>

        <div className="radar-period-group">
          <span className="toolbar-label">統計區間：</span>
          {[1, 5, 10, 20].map(d => (
            <button
              key={d}
              className={`btn-radar-cat ${periodDays === d ? 'active' : ''}`}
              onClick={() => setPeriodDays(d)}
            >
              近 {d} 日
            </button>
          ))}
        </div>
      </div>

      {/* 券商分點選擇器橫排 */}
      <div className="broker-selector-strip">
        {filteredBrokers.slice(0, 24).map(broker => (
          <button
            key={broker.id}
            className={`broker-card-pill ${selectedBrokerId === broker.id ? 'selected' : ''}`}
            onClick={() => setSelectedBrokerId(broker.id)}
            id={`btn-radar-broker-${broker.id}`}
          >
            <div className="b-pill-top">
              <strong>{broker.name}</strong>
              <span className={`b-pill-tag ${broker.isDayTrade ? 'dt' : broker.isGov ? 'gov' : ''}`}>
                {broker.type}
              </span>
            </div>
            <div className="b-pill-region">{broker.region}</div>
          </button>
        ))}
      </div>

      {/* 雙欄：左欄為所選分點買進/賣出個股排行；右欄為全市場隔日沖警戒雷達 */}
      <div className="radar-main-grid">
        <div className="radar-left-col">
          <div className="radar-panel-header">
            <div>
              <h2>
                【{activeBroker.name}】近 {periodDays} 日跨市場個股進出反查
              </h2>
              <p>
                分點屬性：{activeBroker.type}（{activeBroker.region}）｜點擊任一個股可直接進入「2. 個股K線」並自動鎖定【{activeBroker.name}】分點軌跡
              </p>
            </div>
          </div>

          <div className="radar-buy-sell-split">
            {/* 分點重點買超個股 */}
            <div className="radar-table-card">
              <div className="broker-bar red-bar">
                <span>【{activeBroker.name}】近 {periodDays} 日重點買超個股 ({buyList.length})</span>
              </div>
              <table className="broker-table">
                <thead>
                  <tr>
                    <th className="b-col-name">個股</th>
                    <th>動能狀態</th>
                    <th>現價</th>
                    <th>漲跌%</th>
                    <th>買超(張)</th>
                    <th>買均價</th>
                    <th>佔成交%</th>
                    <th>預估損益(萬)</th>
                  </tr>
                </thead>
                <tbody>
                  {buyList.map(item => (
                    <tr
                      key={item.stock.code}
                      className="broker-row row-tint-red"
                      onClick={() => onSelectStockWithBroker(item.stock.code, activeBroker.id)}
                    >
                      <td className="b-col-name">
                        <strong>{item.stock.code} {item.stock.name}</strong>
                      </td>
                      <td>
                        <span className="mom-stage-badge stage-bull">
                          {item.mom?.main?.stageLabel}
                        </span>
                      </td>
                      <td>{item.stock.price}</td>
                      <td className={item.stock.changePct >= 0 ? 'val-up' : 'val-down'}>
                        {item.stock.changePct}%
                      </td>
                      <td className="val-up">+{item.net}</td>
                      <td>{item.avgBuy}</td>
                      <td>{item.shareOfVolPct}%</td>
                      <td className={item.profitWan >= 0 ? 'val-up' : 'val-down'}>
                        {item.profitWan >= 0 ? `+${item.profitWan}` : item.profitWan}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分點重點賣超個股 */}
            <div className="radar-table-card">
              <div className="broker-bar green-bar">
                <span>【{activeBroker.name}】近 {periodDays} 日重點賣超個股 ({sellList.length})</span>
              </div>
              <table className="broker-table">
                <thead>
                  <tr>
                    <th className="b-col-name">個股</th>
                    <th>動能狀態</th>
                    <th>現價</th>
                    <th>漲跌%</th>
                    <th>賣超(張)</th>
                    <th>賣均價</th>
                    <th>佔成交%</th>
                    <th>已實現損益(萬)</th>
                  </tr>
                </thead>
                <tbody>
                  {sellList.map(item => (
                    <tr
                      key={item.stock.code}
                      className="broker-row row-tint-green"
                      onClick={() => onSelectStockWithBroker(item.stock.code, activeBroker.id)}
                    >
                      <td className="b-col-name">
                        <strong>{item.stock.code} {item.stock.name}</strong>
                      </td>
                      <td>
                        <span className="mom-stage-badge stage-bear">
                          {item.mom?.main?.stageLabel}
                        </span>
                      </td>
                      <td>{item.stock.price}</td>
                      <td className={item.stock.changePct >= 0 ? 'val-up' : 'val-down'}>
                        {item.stock.changePct}%
                      </td>
                      <td className="val-down">{item.net}</td>
                      <td>{item.avgSell}</td>
                      <td>{item.shareOfVolPct}%</td>
                      <td className={item.profitWan >= 0 ? 'val-up' : 'val-down'}>
                        {item.profitWan >= 0 ? `+${item.profitWan}` : item.profitWan}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 右欄：隔日沖大戶鎖碼與明日倒貨風險警報 */}
        <div className="radar-right-col">
          <div className="radar-panel-header warning-header">
            <h2>⚡ 隔日沖主力鎖碼警報（留意次日早盤沖銷賣壓）</h2>
            <p>統計凱基-台北、富邦-建國、凱基-新竹等隔日沖分點今日大舉買進佔成交量比重</p>
          </div>
          <table className="broker-table">
            <thead>
              <tr>
                <th className="b-col-name">個股名稱</th>
                <th>成交價</th>
                <th>隔日沖買超</th>
                <th>佔當日量%</th>
                <th className="b-col-name">主要隔日沖分點</th>
              </tr>
            </thead>
            <tbody>
              {dayTradeAlertList.map(item => (
                <tr
                  key={item.stock.code}
                  className="broker-row"
                  onClick={() =>
                    onSelectStockWithBroker(
                      item.stock.code,
                      item.topDtBroker?.id || 'kgi-taipei'
                    )
                  }
                >
                  <td className="b-col-name">
                    <strong>{item.stock.code} {item.stock.name}</strong>
                  </td>
                  <td className={item.stock.changePct >= 0 ? 'val-up' : 'val-down'}>
                    {item.stock.price} ({item.stock.changePct}%)
                  </td>
                  <td className="val-up">+{item.dtNetBuy} 張</td>
                  <td>
                    <span
                      className={item.dtRatioPct >= 5 ? 'bg-highlight-red' : 'val-up'}
                      style={{ padding: '2px 6px', borderRadius: '3px' }}
                    >
                      {item.dtRatioPct}%
                    </span>
                  </td>
                  <td className="b-col-name">
                    {item.topDtBroker ? `${item.topDtBroker.name} (+${item.topDtBroker.net}張)` : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
