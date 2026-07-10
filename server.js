// ==========================================
// PACKAGE: SUNWIN PREDICTION ENGINE V2.0
// ==========================================

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// CONFIG
// ==========================================
const API_LICHSU = 'https://lichsusunwin8h1.onrender.com/api/ditmemaysun';
const PORT = process.env.PORT || 3000;

// ==========================================
// CORE: PHÂN TÍCH THUẬT TOÁN DỰ ĐOÁN
// ==========================================
class SunwinPredictor {
  constructor() {
    this.history = [];
    this.patterns = {
      cau: [],      // Dạng cầu
      nhip: [],     // Nhịp cầu
      diem: [],     // Điểm số
      tile: { tai: 0, xiu: 0 },
      gan: { tai: 0, xiu: 0 }  // Thống kê gần
    };
  }

  // Lấy lịch sử từ API
  async fetchHistory() {
    try {
      const response = await axios.get(API_LICHSU);
      this.history = response.data.data || response.data;
      return this.history;
    } catch (error) {
      console.error('Lỗi lấy lịch sử:', error.message);
      return [];
    }
  }

  // Phân tích cầu (chuỗi kết quả liên tiếp)
  analyzeCau(limit = 20) {
    const recentData = this.history.slice(0, limit);
    const cauList = [];
    let currentCau = { type: null, count: 0, start: null };
    
    for (let i = recentData.length - 1; i >= 0; i--) {
      const kq = recentData[i].Ket_qua;
      if (currentCau.type === null) {
        currentCau = { type: kq, count: 1, start: recentData[i].Phien };
      } else if (currentCau.type === kq) {
        currentCau.count++;
      } else {
        cauList.push({...currentCau});
        currentCau = { type: kq, count: 1, start: recentData[i].Phien };
      }
    }
    cauList.push({...currentCau});
    
    return cauList;
  }

  // Phân tích nhịp Tài/Xỉu (tần suất thay đổi)
  analyzeNhip(limit = 30) {
    const recentData = this.history.slice(0, limit);
    let nhipCount = 0;
    let prevKQ = null;
    
    for (let i = recentData.length - 1; i >= 0; i--) {
      const kq = recentData[i].Ket_qua;
      if (prevKQ !== null && kq !== prevKQ) {
        nhipCount++;
      }
      prevKQ = kq;
    }
    
    const avgNhip = recentData.length > 0 ? 
      (recentData.length / (nhipCount || 1)).toFixed(1) : 0;
    
    return {
      tong_nhip: nhipCount,
      do_dai_trung_binh: parseFloat(avgNhip),
      hien_tai: prevKQ
    };
  }

  // Phân tích điểm số (Tổng điểm)
  analyzeDiem(limit = 20) {
    const recentData = this.history.slice(0, limit);
    const diemList = recentData.map(d => d.Tong);
    
    const sum = diemList.reduce((a, b) => a + b, 0);
    const avg = diemList.length > 0 ? (sum / diemList.length).toFixed(2) : 0;
    const min = Math.min(...diemList);
    const max = Math.max(...diemList);
    
    // Đếm tần suất các mức điểm
    const freq = {};
    diemList.forEach(d => {
      freq[d] = (freq[d] || 0) + 1;
    });
    
    // Tìm điểm xuất hiện nhiều nhất
    let mostFreqDiem = null;
    let maxFreq = 0;
    for (const [diem, count] of Object.entries(freq)) {
      if (count > maxFreq) {
        maxFreq = count;
        mostFreqDiem = parseInt(diem);
      }
    }
    
    return {
      trung_binh: parseFloat(avg),
      thap_nhat: min,
      cao_nhat: max,
      xuat_hien_nhieu: mostFreqDiem,
      phan_bo: freq
    };
  }

  // Phân tích tỷ lệ Tài/Xỉu
  analyzeTiLe(limit = 50) {
    const recentData = this.history.slice(0, limit);
    let tai = 0, xiu = 0;
    
    recentData.forEach(d => {
      if (d.Ket_qua === 'Tài') tai++;
      else xiu++;
    });
    
    const total = tai + xiu;
    return {
      tai: { count: tai, percent: total > 0 ? ((tai/total)*100).toFixed(1) : 0 },
      xiu: { count: xiu, percent: total > 0 ? ((xiu/total)*100).toFixed(1) : 0 },
      tong: total
    };
  }

  // Phát hiện cầu đặc biệt
  detectSpecialPatterns(limit = 20) {
    const recentData = this.history.slice(0, limit);
    const patterns = [];
    
    // Cầu 1-1 (T X T X)
    if (this.checkPattern1_1(recentData)) {
      patterns.push({ type: 'CẦU 1-1', mo_ta: 'Tài Xỉu xen kẽ nhau' });
    }
    
    // Cầu bệt (liên tục 1 bên)
    const betPattern = this.checkBet(recentData);
    if (betPattern) {
      patterns.push({ type: 'CẦU BỆT', mo_ta: `${betPattern.side} liên tục ${betPattern.count} phiên` });
    }
    
    // Cầu 2-1 (T T X)
    if (this.checkPattern2_1(recentData)) {
      patterns.push({ type: 'CẦU 2-1', mo_ta: '2 Tài - 1 Xỉu hoặc ngược lại' });
    }
    
    return patterns;
  }

  checkPattern1_1(data) {
    if (data.length < 4) return false;
    const last4 = data.slice(0, 4).map(d => d.Ket_qua);
    return (last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] !== last4[3]);
  }

  checkBet(data) {
    if (data.length < 3) return null;
    let count = 1;
    const side = data[0].Ket_qua;
    
    for (let i = 1; i < Math.min(data.length, 10); i++) {
      if (data[i].Ket_qua === side) count++;
      else break;
    }
    
    return count >= 3 ? { side, count } : null;
  }

  checkPattern2_1(data) {
    if (data.length < 3) return false;
    const last3 = data.slice(0, 3).map(d => d.Ket_qua);
    return (
      (last3[0] === last3[1] && last3[1] !== last3[2]) ||
      (last3[0] !== last3[1] && last3[1] === last3[2])
    );
  }

  // Dự đoán chính
  async duDoan() {
    await this.fetchHistory();
    
    if (this.history.length === 0) {
      return { error: 'Không có dữ liệu lịch sử' };
    }

    const cau = this.analyzeCau(20);
    const nhip = this.analyzeNhip(30);
    const diem = this.analyzeDiem(20);
    const tile = this.analyzeTiLe(50);
    const specialPatterns = this.detectSpecialPatterns(20);
    
    // Logic dự đoán dựa trên phân tích
    let duDoan = 'Không xác định';
    let doTinCay = 0;
    let lyDo = [];
    
    const lastResult = this.history[0].Ket_qua;
    const lastTong = this.history[0].Tong;
    
    // 1. Phân tích cầu hiện tại
    if (cau.length > 0 && cau[0].count >= 2) {
      if (cau[0].count >= 4) {
        // Cầu dài có khả năng gãy
        duDoan = lastResult === 'Tài' ? 'Xỉu' : 'Tài';
        doTinCay += 25;
        lyDo.push(`Cầu ${lastResult} kéo dài ${cau[0].count} phiên, khả năng gãy cầu cao`);
      } else {
        // Cầu ngắn tiếp tục theo xu hướng
        duDoan = lastResult;
        doTinCay += 20;
        lyDo.push(`Cầu ${lastResult} đang hình thành (${cau[0].count} phiên)`);
      }
    }
    
    // 2. Phân tích điểm trung bình
    if (diem.trung_binh > 10.5) {
      duDoan = (duDoan === 'Không xác định') ? 'Tài' : duDoan;
      doTinCay += 15;
      lyDo.push(`Điểm trung bình cao (${diem.trung_binh}) nghiêng về Tài`);
    } else if (diem.trung_binh < 10.5) {
      duDoan = (duDoan === 'Không xác định') ? 'Xỉu' : duDoan;
      doTinCay += 15;
      lyDo.push(`Điểm trung bình thấp (${diem.trung_binh}) nghiêng về Xỉu`);
    }
    
    // 3. Phân tích tỷ lệ tổng
    if (tile.tai.count > tile.xiu.count * 1.2) {
      if (duDoan === 'Tài') doTinCay += 10;
      else if (duDoan === 'Không xác định') duDoan = 'Xỉu';
      lyDo.push(`Tài áp đảo (${tile.tai.percent}%), có thể về Xỉu cân bằng`);
    } else if (tile.xiu.count > tile.tai.count * 1.2) {
      if (duDoan === 'Xỉu') doTinCay += 10;
      else if (duDoan === 'Không xác định') duDoan = 'Tài';
      lyDo.push(`Xỉu áp đảo (${tile.xiu.percent}%), có thể về Tài cân bằng`);
    }
    
    // 4. Cầu đặc biệt
    if (specialPatterns.length > 0) {
      const pattern = specialPatterns[0];
      lyDo.push(`Phát hiện: ${pattern.type} - ${pattern.mo_ta}`);
      if (pattern.type === 'CẦU BỆT') {
        doTinCay -= 10;
        lyDo.push('Cảnh báo: Cầu bệt dễ gãy đột ngột!');
      }
    }
    
    // Chuẩn hóa độ tin cậy
    doTinCay = Math.min(Math.max(doTinCay, 30), 85);
    
    // Dự đoán cuối cùng nếu chưa xác định
    if (duDoan === 'Không xác định') {
      duDoan = lastResult === 'Tài' ? 'Xỉu' : 'Tài';
      doTinCay = 40;
      lyDo.push('Dựa vào quy luật xen kẽ cơ bản');
    }
    
    return {
      du_doan: duDoan,
      do_tin_cay: doTinCay + '%',
      ly_do: lyDo,
      phien_hien_tai: this.history[0],
      phien_du_doan: {
        phien: this.history[0].Phien + 1,
        du_doan: duDoan,
        xu_huong: this.getXuHuong(diem.trung_binh)
      },
      thong_ke: {
        cau_hien_tai: cau[0],
        nhip_cau: nhip,
        diem_phan_tich: diem,
        ti_le: tile,
        cau_dac_biet: specialPatterns
      },
      canh_bao: this.getCanhBao(doTinCay, specialPatterns)
    };
  }

  getXuHuong(avgDiem) {
    if (avgDiem > 11.5) return 'Xu hướng Tài mạnh';
    if (avgDiem > 10.5) return 'Xu hướng Tài nhẹ';
    if (avgDiem < 9.5) return 'Xu hướng Xỉu mạnh';
    if (avgDiem < 10.5) return 'Xu hướng Xỉu nhẹ';
    return 'Cân bằng';
  }

  getCanhBao(doTinCay, patterns) {
    const canhBao = [];
    if (doTinCay < 50) canhBao.push('Độ tin cậy thấp, cân nhắc trước khi đặt');
    if (patterns.some(p => p.type === 'CẦU BỆT')) {
      canhBao.push('Cầu bệt có thể gãy bất ngờ!');
    }
    if (canhBao.length === 0) canhBao.push('Không có cảnh báo đặc biệt');
    return canhBao;
  }
}

// ==========================================
// API ENDPOINTS
// ==========================================
const predictor = new SunwinPredictor();

// Endpoint chính: /vanhoa
app.get('/vanhoa', async (req, res) => {
  try {
    const ketQua = await predictor.duDoan();
    res.json({
      status: 'success',
      message: '🎯 Dự đoán Sunwin - Tài Xỉu',
      data: ketQua,
      luu_y: '⚠️ Dự đoán chỉ mang tính tham khảo, không đảm bảo chính xác 100%'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Lỗi phân tích dữ liệu',
      error: error.message
    });
  }
});

// Endpoint lấy lịch sử
app.get('/lichsu', async (req, res) => {
  try {
    await predictor.fetchHistory();
    res.json({
      status: 'success',
      data: predictor.history.slice(0, 20),
      tong_phien: predictor.history.length
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Endpoint thống kê chi tiết
app.get('/thongke', async (req, res) => {
  try {
    await predictor.fetchHistory();
    res.json({
      status: 'success',
      data: {
        ti_le: predictor.analyzeTiLe(50),
        diem: predictor.analyzeDiem(20),
        cau: predictor.analyzeCau(20),
        nhip: predictor.analyzeNhip(30),
        cau_dac_biet: predictor.detectSpecialPatterns(20)
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Trang chủ
app.get('/', (req, res) => {
  res.json({
    name: 'Sunwin Prediction Engine V2.0',
    version: '2.0.0',
    endpoints: {
      du_doan: '/vanhoa',
      lich_su: '/lichsu',
      thong_ke: '/thongke'
    },
    mo_ta: 'Hệ thống dự đoán Tài Xỉu Sunwin bằng thuật toán phân tích đa chiều',
    tinh_nang: [
      'Phân tích cầu động',
      'Phát hiện cầu đặc biệt',
      'Thống kê điểm số',
      'Tỷ lệ Tài/Xỉu',
      'Cảnh báo rủi ro'
    ]
  });
});

// ==========================================
// KHỞI ĐỘNG SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Sunwin Predictor chạy trên cổng ${PORT}`);
  console.log(`📊 Dự đoán: http://localhost:${PORT}/vanhoa`);
  console.log(`📈 Thống kê: http://localhost:${PORT}/thongke`);
});

module.exports = app;
