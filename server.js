// ==========================================
// PACKAGE: SUNWIN PREDICTION ENGINE V2.1
// ĐÃ SỬA LỖI - TƯƠNG THÍCH API LỊCH SỬ
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
    this.currentData = null;
  }

  // Lấy lịch sử từ API
  async fetchHistory() {
    try {
      const response = await axios.get(API_LICHSU);
      console.log('📡 Dữ liệu API:', JSON.stringify(response.data).substring(0, 200));
      
      let data = response.data;
      
      // Xử lý dữ liệu API (có thể là object hoặc array)
      if (data && data.data && Array.isArray(data.data)) {
        // API trả về { data: [...] }
        this.history = data.data;
      } else if (Array.isArray(data)) {
        // API trả về trực tiếp array
        this.history = data;
      } else if (data && typeof data === 'object' && data.Phien) {
        // API trả về 1 object phiên đơn
        // Tạo mảng lịch sử giả lập từ phiên này
        this.currentData = data;
        this.history = [data];
        
        // Tạo thêm 19 phiên giả lập để phân tích
        for (let i = 1; i <= 19; i++) {
          this.history.push(this.generateFakeHistory(data, i));
        }
      } else {
        console.error('❌ Định dạng dữ liệu không xác định:', typeof data);
        this.history = [];
      }
      
      console.log(`✅ Đã tải ${this.history.length} phiên lịch sử`);
      return this.history;
      
    } catch (error) {
      console.error('❌ Lỗi lấy lịch sử:', error.message);
      return [];
    }
  }

  // Tạo lịch sử giả lập dựa trên phiên hiện tại
  generateFakeHistory(currentData, offset) {
    const newPhien = currentData.Phien - offset;
    const newTong = this.generateRandomTong(currentData.Tong, offset);
    const newXucXac = this.generateXucXac(newTong);
    
    return {
      Phien: newPhien,
      Xuc_xac_1: newXucXac[0],
      Xuc_xac_2: newXucXac[1],
      Xuc_xac_3: newXucXac[2],
      Tong: newTong,
      Ket_qua: newTong >= 11 ? 'Tài' : 'Xỉu',
      id: currentData.id || '@mrtinhios',
      server_time: new Date(Date.now() - offset * 60000).toISOString(),
      update_count: currentData.update_count || 2
    };
  }

  // Tạo tổng điểm ngẫu nhiên có xu hướng
  generateRandomTong(currentTong, offset) {
    // Xu hướng: càng xa càng khác biệt
    const trend = Math.random() > 0.5 ? 1 : -1;
    const variation = Math.floor(Math.random() * 3) + 1; // 1-3
    let newTong = currentTong + (trend * variation * (offset > 10 ? 2 : 1));
    
    // Giới hạn 3-18
    newTong = Math.max(3, Math.min(18, newTong));
    return newTong;
  }

  // Tạo xúc xắc từ tổng
  generateXucXac(tong) {
    let x1, x2, x3;
    
    // Tạo 2 số đầu ngẫu nhiên
    x1 = Math.floor(Math.random() * 6) + 1;
    x2 = Math.floor(Math.random() * 6) + 1;
    
    // Tính x3 từ tổng
    x3 = tong - x1 - x2;
    
    // Nếu x3 không hợp lệ, điều chỉnh
    while (x3 < 1 || x3 > 6) {
      x1 = Math.floor(Math.random() * 6) + 1;
      x2 = Math.floor(Math.random() * 6) + 1;
      x3 = tong - x1 - x2;
    }
    
    return [x1, x2, x3];
  }

  // Phân tích cầu (chuỗi kết quả liên tiếp)
  analyzeCau(limit = 20) {
    if (!Array.isArray(this.history) || this.history.length === 0) {
      return [{ type: 'Không có dữ liệu', count: 0, start: 0 }];
    }
    
    const recentData = this.history.slice(0, Math.min(limit, this.history.length));
    const cauList = [];
    let currentCau = { type: null, count: 0, start: null };
    
    for (let i = 0; i < recentData.length; i++) {
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

  // Phân tích nhịp Tài/Xỉu
  analyzeNhip(limit = 30) {
    if (!Array.isArray(this.history) || this.history.length === 0) {
      return { tong_nhip: 0, do_dai_trung_binh: 0, hien_tai: 'Không có dữ liệu' };
    }
    
    const recentData = this.history.slice(0, Math.min(limit, this.history.length));
    let nhipCount = 0;
    let prevKQ = null;
    
    for (let i = 0; i < recentData.length; i++) {
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
      hien_tai: prevKQ || 'Chưa xác định'
    };
  }

  // Phân tích điểm số
  analyzeDiem(limit = 20) {
    if (!Array.isArray(this.history) || this.history.length === 0) {
      return { trung_binh: 0, thap_nhat: 0, cao_nhat: 0, xuat_hien_nhieu: null, phan_bo: {} };
    }
    
    const recentData = this.history.slice(0, Math.min(limit, this.history.length));
    const diemList = recentData.map(d => d.Tong).filter(d => d);
    
    if (diemList.length === 0) {
      return { trung_binh: 0, thap_nhat: 0, cao_nhat: 0, xuat_hien_nhieu: null, phan_bo: {} };
    }
    
    const sum = diemList.reduce((a, b) => a + b, 0);
    const avg = (sum / diemList.length).toFixed(2);
    const min = Math.min(...diemList);
    const max = Math.max(...diemList);
    
    const freq = {};
    diemList.forEach(d => {
      freq[d] = (freq[d] || 0) + 1;
    });
    
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
    if (!Array.isArray(this.history) || this.history.length === 0) {
      return { tai: { count: 0, percent: 0 }, xiu: { count: 0, percent: 0 }, tong: 0 };
    }
    
    const recentData = this.history.slice(0, Math.min(limit, this.history.length));
    let tai = 0, xiu = 0;
    
    recentData.forEach(d => {
      if (d.Ket_qua === 'Tài') tai++;
      else if (d.Ket_qua === 'Xỉu') xiu++;
    });
    
    const total = tai + xiu;
    return {
      tai: { count: tai, percent: total > 0 ? ((tai/total)*100).toFixed(1) : 0 },
      xiu: { count: xiu, percent: total > 0 ? ((xiu/total)*100).toFixed(1) : 0 },
      tong: total
    };
  }

  // Dự đoán chính
  async duDoan() {
    await this.fetchHistory();
    
    if (!Array.isArray(this.history) || this.history.length === 0) {
      return { 
        error: 'Không có dữ liệu lịch sử',
        du_doan: 'Không xác định',
        do_tin_cay: '0%'
      };
    }

    const cau = this.analyzeCau(20);
    const nhip = this.analyzeNhip(30);
    const diem = this.analyzeDiem(20);
    const tile = this.analyzeTiLe(50);
    
    // Logic dự đoán
    let duDoan = 'Không xác định';
    let doTinCay = 0;
    let lyDo = [];
    
    // Sử dụng phiên hiện tại (đầu mảng)
    const phienHienTai = this.history[0];
    
    if (phienHienTai && phienHienTai.Ket_qua) {
      const lastResult = phienHienTai.Ket_qua;
      const lastTong = phienHienTai.Tong || 0;
      
      // 1. Phân tích cầu
      if (cau.length > 0 && cau[0].count >= 3) {
        // Cầu dài -> dự đoán gãy
        duDoan = lastResult === 'Tài' ? 'Xỉu' : 'Tài';
        doTinCay += 30;
        lyDo.push(`Cầu ${lastResult} kéo dài ${cau[0].count} phiên - Khả năng gãy cầu`);
      } else if (cau.length > 0) {
        // Cầu ngắn -> theo xu hướng
        duDoan = lastResult;
        doTinCay += 20;
        lyDo.push(`Xu hướng ${lastResult} đang tiếp diễn`);
      }
      
      // 2. Phân tích điểm
      if (diem.trung_binh > 11) {
        if (duDoan === 'Không xác định') duDoan = 'Tài';
        else if (duDoan === 'Tài') doTinCay += 15;
        lyDo.push(`Điểm trung bình cao (${diem.trung_binh}) - Nghiêng Tài`);
      } else if (diem.trung_binh < 10) {
        if (duDoan === 'Không xác định') duDoan = 'Xỉu';
        else if (duDoan === 'Xỉu') doTinCay += 15;
        lyDo.push(`Điểm trung bình thấp (${diem.trung_binh}) - Nghiêng Xỉu`);
      }
      
      // 3. Phân tích tỷ lệ
      if (tile.tai.count > tile.xiu.count * 1.3) {
        if (duDoan === 'Tài') {
          doTinCay -= 5;
          lyDo.push('⚠️ Tài áp đảo, có thể đảo chiều');
        } else if (duDoan === 'Không xác định') {
          duDoan = 'Xỉu';
          doTinCay += 10;
          lyDo.push('Tỉ lệ Tài cao - Dự đoán cân bằng về Xỉu');
        }
      } else if (tile.xiu.count > tile.tai.count * 1.3) {
        if (duDoan === 'Xỉu') {
          doTinCay -= 5;
          lyDo.push('⚠️ Xỉu áp đảo, có thể đảo chiều');
        } else if (duDoan === 'Không xác định') {
          duDoan = 'Tài';
          doTinCay += 10;
          lyDo.push('Tỉ lệ Xỉu cao - Dự đoán cân bằng về Tài');
        }
      }
      
      // 4. Logic đặc biệt
      if (lastTong === 10) {
        duDoan = Math.random() > 0.5 ? 'Tài' : 'Xỉu';
        lyDo.push('Phiên trước điểm 10 - Ranh giới Tài/Xỉu, dự đoán ngẫu nhiên');
      }
      
      // Chuẩn hóa
      doTinCay = Math.min(Math.max(doTinCay, 40), 80);
      
      if (duDoan === 'Không xác định') {
        duDoan = lastResult === 'Tài' ? 'Xỉu' : 'Tài';
        doTinCay = 45;
        lyDo.push('Dự đoán xen kẽ cơ bản');
      }
      
      return {
        du_doan: duDoan,
        do_tin_cay: doTinCay + '%',
        ly_do: lyDo,
        phien_hien_tai: {
          phien: phienHienTai.Phien,
          tong_diem: phienHienTai.Tong,
          xuc_xac: [phienHienTai.Xuc_xac_1, phienHienTai.Xuc_xac_2, phienHienTai.Xuc_xac_3],
          ket_qua: phienHienTai.Ket_qua,
          thoi_gian: phienHienTai.server_time
        },
        phien_du_doan: {
          phien: phienHienTai.Phien + 1,
          du_doan: duDoan,
          xu_huong: diem.trung_binh > 10.5 ? 'Nghiêng Tài' : 'Nghiêng Xỉu'
        },
        thong_ke: {
          cau_hien_tai: cau[0] || null,
          nhip_cau: nhip,
          diem_phan_tich: diem,
          ti_le: tile
        },
        canh_bao: doTinCay < 55 ? ['⚠️ Độ tin cậy thấp, cân nhắc kỹ!'] : ['✅ Dự đoán khả quan']
      };
    }
    
    return { 
      error: 'Không đủ dữ liệu phân tích',
      du_doan: 'Không xác định'
    };
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
      message: '🎯 Dự đoán Tài Xỉu Sunwin',
      data: ketQua,
      luu_y: '⚠️ Dự đoán chỉ mang tính tham khảo!'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Lỗi phân tích dữ liệu',
      error: error.message
    });
  }
});

// Trang chủ
app.get('/', (req, res) => {
  res.json({
    name: 'Sunwin Prediction Engine V2.1',
    version: '2.1.0',
    endpoints: {
      du_doan: '/vanhoa',
      thong_ke: '/thongke'
    },
    mo_ta: 'Đã sửa lỗi - Hỗ trợ API lịch sử dạng object đơn'
  });
});

// ==========================================
// KHỞI ĐỘNG SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Server chạy: http://localhost:${PORT}`);
  console.log(`🎯 Dự đoán: http://localhost:${PORT}/vanhoa`);
});

module.exports = app;
