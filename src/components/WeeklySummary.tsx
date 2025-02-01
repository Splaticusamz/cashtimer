import React from 'react';

export type LogEntry = {
  date: string;
  hours: number;
  rate: number;
};

type WeeklySummaryProps = {
  logs: LogEntry[];
};

const WeeklySummary: React.FC<WeeklySummaryProps> = ({ logs }) => {
  // round hours up to next quarter hour
  const roundToNextQuarter = (hours: number): number => {
    return Math.ceil(hours * 4) / 4;
  };

  const handleCopyForInvoicing = async () => {
    let totalHours = 0;
    let totalCost = 0;
    const lines: string[] = [];
    // header row
    lines.push("Date\tHours\tRate\tTotal");

    logs.forEach(entry => {
      const roundedHours = roundToNextQuarter(entry.hours);
      const cost = roundedHours * entry.rate;
      totalHours += roundedHours;
      totalCost += cost;
      lines.push(`${entry.date}\t${roundedHours}\t${entry.rate}\t${cost.toFixed(2)}`);
    });
    // total row
    lines.push(`Total\t${totalHours}\t\t${totalCost.toFixed(2)}`);

    const tableText = lines.join("\n");

    try {
      await navigator.clipboard.writeText(tableText);
      alert("Copied for invoicing!");
    } catch (err) {
      alert("Failed to copy text: " + err);
    }
  };

  return (
    <div>
      <table style={{ borderCollapse: 'collapse', marginBottom: '1rem' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Date</th>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Hours</th>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Rate</th>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((entry, index) => {
            const roundedHours = roundToNextQuarter(entry.hours);
            const cost = roundedHours * entry.rate;
            return (
              <tr key={index}>
                <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{entry.date}</td>
                <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{roundedHours}</td>
                <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{entry.rate}</td>
                <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{cost.toFixed(2)}</td>
              </tr>
            );
          })}
          <tr>
            <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Total</td>
            <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
              {logs.reduce((sum, entry) => sum + roundToNextQuarter(entry.hours), 0)}
            </td>
            <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}></td>
            <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
              {logs.reduce((sum, entry) => sum + roundToNextQuarter(entry.hours) * entry.rate, 0).toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
      <button onClick={handleCopyForInvoicing}>Copy for invoicing</button>
    </div>
  );
};

export default WeeklySummary; 