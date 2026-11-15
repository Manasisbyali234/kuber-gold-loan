// Seed data – applied once when the database is empty.
// Dates are stored as YYYY-MM-DD internally.

const parseDMY = (s) => {
  const [d, m, y] = s.split('-');
  return `${y}-${m}-${d}`;
};

const uid = (prefix) => prefix + Math.random().toString(36).slice(2, 9);

// Raw table rows: [loanNo, customerName, date, dueDate, status, principal, interest, paid, outstanding]
const RAW = [
  ['GL/2026-27/A063','Husensab Doulatdar','17-09-2026','17-09-2027','active',1500,45,0,1545],
  ['GL/2026-27/A062','Nirmal Kattimani','17-09-2026','17-09-2027','active',3000,90,0,3090],
  ['GL/2026-27/A061','Saraswati Holeyannavar','16-12-2024','16-12-2027','active',500,330,0,830],
  ['GL/2026-27/A060','Renuka Itagi','16-07-2026','16-07-2027','active',3000,270,0,3270],
  ['GL/2026-27/A059','Nasrin Kalaburgi','16-09-2026','16-09-2027','active',1500,45,0,1545],
  ['GL/2026-27/A058','Nabi Mulla','16-09-2026','16-09-2027','active',2500,75,0,2575],
  ['GL/2026-27/A057','Gangava Chalawadi','15-02-2025','15-02-2027','active',1000,600,0,1600],
  ['GL/2026-27/A056','Bibiasha Dharawad','15-03-2025','15-03-2027','active',4500,2565,0,7065],
  ['GL/2026-27/A055','Salma Ramapur','15-08-2026','15-08-2027','active',2000,120,0,2120],
  ['GL/2026-27/A054','Salma Yaraguppi','15-09-2026','15-09-2027','active',2500,75,0,2575],
  ['GL/2026-27/A053','Shantava Doddamani','15-09-2026','15-09-2027','active',2000,60,0,2060],
  ['GL/2026-27/A052','Renuka Itagi','21-10-2025','21-10-2027','active',500,180,0,680],
  ['GL/2026-27/A051','Hema Madar','14-03-2026','14-03-2027','active',800,168,0,968],
  ['GL/2026-27/A050','Savita Doni','14-09-2026','14-09-2027','active',500,15,0,515],
  ['GL/2026-27/A049','Reshama Kotewale','13-11-2025','13-11-2026','active',2500,825,0,3325],
  ['GL/2026-27/A048','Shahina Attar','13-06-2026','13-06-2027','active',700,84,0,784],
  ['GL/2026-27/A047','Asha Gadad','12-02-2026','12-02-2027','active',500,120,0,620],
  ['GL/2026-27/A046','Bassama Bijapur','25-01-2025','25-01-2027','active',3000,1890,0,4890],
  ['GL/2026-27/A045','Siddaraj Kalal','12-03-2026','12-03-2027','active',2000,420,0,2420],
  ['GL/2026-27/A044','Pushapa Pattar','12-08-2026','12-08-2027','active',2300,138,0,2438],
  ['GL/2026-27/A043','Ganesh Jadava','12-08-2026','12-08-2027','active',2000,120,0,2120],
  ['GL/2026-27/A042','Jafar Momin','12-08-2026','12-08-2027','active',5000,300,0,5300],
  ['GL/2026-27/A041','Rahul Habib','11-02-2025','11-02-2026','closed',3500,2100,0,0],
  ['GL/2026-27/A040','Bibiasha Bijapur','11-01-2025','11-01-2026','active',1000,630,0,1630],
  ['GL/2026-27/A039','Mumtaz Tiralapur','11-06-2026','11-07-2026','active',5000,600,0,5600],
  ['GL/2026-27/A038','Shahirabanu Shekh','11-08-2026','11-08-2027','active',500,30,0,530],
  ['GL/2026-27/A037','Musabi Ilakal','10-04-2026','10-04-2027','active',1000,180,0,1180],
  ['GL/2026-27/A036','Davalbi Yaligar','10-07-2026','10-07-2027','active',1000,90,0,1090],
  ['GL/2026-27/A035','Pooja Ghatge','10-08-2026','10-08-2027','active',2000,120,0,2120],
  ['GL/2026-27/A034','Asma Bankapur','09-04-2026','09-04-2027','active',4000,720,0,4720],
  ['GL/2026-27/A033','Ravi Pujari','08-06-2016','08-06-2016','active',5000,0,0,5000],
  ['GL/2026-27/A032','Vijaylaxmi Bisnalli','08-06-2024','08-06-2024','active',600,0,0,600],
  ['GL/2026-27/A031','DR Shanul','08-01-2025','08-01-2028','active',7000,7350,0,14350],
  ['GL/2026-27/A030','Gangava Lakshameshawar','08-09-2026','08-09-2027','active',2500,75,0,2575],
  ['GL/2026-27/A029','Venktesh Patil','10-02-2025','10-02-2025','active',1500,0,0,1500],
  ['GL/2026-27/A028','Venktesh Patil','08-02-2025','08-02-2025','active',1500,0,0,1500],
  ['GL/2026-27/A027','Khalandra Naragund','07-03-2025','07-03-2026','active',1400,798,0,2198],
  ['GL/2026-27/A026','Ganesh Maknur','06-09-2010','06-09-2010','active',1000,0,0,1000],
  ['GL/2026-27/A025','Rajeshawari Ilager','06-06-2024','06-06-2027','active',700,588,0,1288],
  ['GL/2026-27/A024','Kumar Araksali','05-04-2021','05-04-2021','active',600,0,0,600],
  ['GL/2026-27/A023','Parashuram Solanki','05-11-2024','05-11-2026','active',1500,1035,0,2535],
  ['GL/2026-27/A022','Lakshami Harivan','05-09-2025','05-09-2026','active',500,195,0,695],
  ['GL/2026-27/A021','Abhishekh Gantode','04-10-2025','04-10-2025','active',200,72,0,272],
  ['GL/2026-27/A020','Asha Gadad','04-09-2026','04-09-2027','active',500,15,0,515],
  ['GL/2026-27/A019','Tulasidas Basava','03-01-2021','03-01-2021','active',40000,55200,0,95200],
  ['GL/2026-27/A018','Durgavva Tattimani','03-06-2022','03-06-2022','active',200,0,0,200],
  ['GL/2026-27/A017','Shobha Meharwade','03-04-2026','03-04-2027','active',3600,648,0,4248],
  ['GL/2026-27/A016','Ashwini Kotekar','03-02-2026','03-02-2027','active',1500,360,0,1860],
  ['GL/2026-27/A015','Husensab Doulatdar','02-02-2026','02-02-2028','active',1000,240,0,1240],
  ['GL/2026-27/A014','Rajesh Kotabagi','02-11-2021','02-11-2021','active',600,0,0,600],
  ['GL/2026-27/A013','Santosh Kalal','02-09-2021','02-09-2021','active',1000,0,0,1000],
  ['GL/2026-27/A012','Ashok Habib','02-12-2023','02-12-2023','active',2000,0,0,2000],
  ['GL/2026-27/A011','Sanju Chalawadi','02-02-2024','02-02-2028','active',3000,4800,0,7800],
  ['GL/2026-27/A010','Shahirabanu Bannur','02-06-2026','02-06-2030','active',500,60,0,560],
  ['GL/2026-27/A009','Girija Pathan','02-07-2026','02-07-2028','active',1000,90,0,1090],
  ['GL/2026-27/A008','Renuka Itagi','02-08-2026','02-08-2028','active',2500,150,0,2650],
  ['GL/2026-27/A007','Salma Ramapur','02-08-2026','02-08-2028','active',2000,120,0,2120],
  ['GL/2026-27/A006','Mallava Khanapur','21-12-2025','21-12-2029','active',800,240,0,1040],
  ['GL/2026-27/A005','Mallava Khanapur','11-12-2025','11-12-2029','active',800,240,0,1040],
  ['GL/2026-27/A004','Mallikarjun Kumbar','02-03-2024','02-03-2025','active',2500,0,2325,175],
  ['GL/2026-27/A003','Krishana Kulakarni','01-05-2023','01-05-2028','active',7570,0,0,7570],
  ['GL/2026-27/A002','Basavaraj Mangoni','01-10-2024','01-10-2027','active',800,576,0,1376],
  ['GL/2026-27/A001','Vinayak Kabade','01-08-2026','01-08-2027','active',1000,100,100,1000],
];

export function buildSeedData() {
  const customers = [];
  const loans = [];
  const payments = [];

  // Deduplicate customers by trimmed name
  const custMap = {}; // name → customer object
  let custSerial = 1;

  RAW.forEach(([loanNo, rawName]) => {
    const name = rawName.trim();
    if (!custMap[name]) {
      const custNo = 'CUS-' + String(custSerial++).padStart(3, '0');
      custMap[name] = { id: uid('c'), custNo, name, phone: '', address: '', idType: 'Aadhaar', idNo: '', photo: null, idPhoto: null, createdAt: '2024-01-01' };
      customers.push(custMap[name]);
    }
  });

  RAW.forEach(([loanNo, rawName, dateStr, dueDateStr, status, principal, , paid]) => {
    const name = rawName.trim();
    const cust = custMap[name];
    const loanId = uid('l');
    const date = parseDMY(dateStr);
    const dueDate = parseDMY(dueDateStr);

    // Derive rate: interest is pre-computed in the table; store rate=0 and use
    // a fixed payment record for the pre-existing interest so the app's calc()
    // stays consistent. We store rate=0 so no additional interest accrues from
    // today (historical data – operator can edit individual loans as needed).
    loans.push({
      id: loanId,
      no: loanNo,
      customerId: cust.id,
      ornaments: [{ desc: 'Gold ornament', weight: '', purity: '22', metal: 'Gold' }],
      itemDesc: 'Gold ornament',
      weight: 0,
      purity: '22',
      principal,
      rate: 0,
      interestMode: 'month',
      date,
      dueDate,
      goldPhoto: null,
      signaturePaths: [],
      status,
      ...(status === 'closed' ? { closedOn: dueDate } : {}),
    });

    // Record paid amount as a payment entry
    if (paid > 0) {
      payments.push({
        id: uid('p'),
        loanId,
        amount: paid,
        note: 'Opening payment',
        date,
        colType: 'capital',
        method: 'Cash',
      });
    }
  });

  return { customers, loans, payments };
}
