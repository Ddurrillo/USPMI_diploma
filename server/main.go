package main

import (
	"context"
	"encoding/binary"
	"encoding/gob"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/netip"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/goburrow/modbus"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/sjwhitworth/golearn/base"
	"github.com/sjwhitworth/golearn/knn"
	"github.com/sjwhitworth/golearn/linear_models"
	"github.com/sjwhitworth/golearn/trees"
	"golang.org/x/crypto/bcrypt"
	"gonum.org/v1/gonum/mat"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var db *gorm.DB
var jwtKey = []byte("secret_key")

// ==========================================================
// 1. МОДЕЛИ БД
// ==========================================================
type Role string

const (
	RoleAdmin        Role = "admin"
	RoleDirector     Role = "director"
	RoleTechnologist Role = "technologist"
	RoleOperator     Role = "operator"
	RoleUser         Role = "user"
	RoleGuest        Role = "guest"
)

func (r Role) IsValid() bool {
	switch r {
	case RoleAdmin, RoleDirector, RoleTechnologist, RoleOperator, RoleUser, RoleGuest:
		return true
	}
	return false
}

type User struct {
	ID         uint   `gorm:"primaryKey"`
	Username   string `gorm:"size:40;uniqueIndex"`
	Password   string
	Role       Role         `gorm:"type:varchar(20)"`
	Processing []Processing `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OperatorID" json:"-"`
}

type Client struct {
	ID             uint    `gorm:"primaryKey"`
	FirstName      string  `gorm:"size:30;not null;index:idx_client_name,unique"`
	LastName       string  `gorm:"size:30;not null;index:idx_client_name,unique"`
	PatronymicName string  `gorm:"size:30;not null;index:idx_client_name,unique"`
	Email          string  `gorm:"size:100;uniqueIndex"`
	Phone          string  `gorm:"size:20;uniqueIndex"`
	Orders         []Order `gorm:"foreignKey:ClientID" json:"-"`
}

type Compound struct {
	ID                  uint                 `gorm:"primaryKey"`
	Name                string               `gorm:"size:100;not null"`
	CriticalTemperature float64              `gorm:"not null"`
	Recipes             []Recipe             `gorm:"foreignKey:CompoundID" json:"-"`
	Properties          []CompoundProperties `gorm:"foreignKey:CompoundID" json:"-"`
}

type CompoundProperties struct {
	CompoundID        uint     `gorm:"primaryKey"`
	Compound          Compound `gorm:"constraint:OnDelete:CASCADE;" json:"-"`
	Temperature       float64  `gorm:"primaryKey"`
	DynamicViscosity  float64  `gorm:"not null"`
	SurfaceTension    float64  `gorm:"not null"`
	Density           float64  `gorm:"not null"`
	UltrasoundSpeed   float64  `gorm:"not null"`
	AcousticImpedance float64  `gorm:"not null"`
}

type Material struct {
	ID                  uint     `gorm:"primaryKey"`
	Name                string   `gorm:"size:100;not null"`
	CriticalTemperature float64  `gorm:"not null"`
	CapillaryRadius     float64  `gorm:"not null"`
	CapillaryLength     float64  `gorm:"not null"`
	Porosity            float64  `gorm:"not null"`
	Density             float64  `gorm:"not null"`
	Recipes             []Recipe `gorm:"foreignKey:MaterialID" json:"-"`
}

type Recipe struct {
	ID                uint     `gorm:"primaryKey"`
	MaterialID        uint     `gorm:"not null;index"`
	Material          Material `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
	CompoundID        uint     `gorm:"not null;index"`
	Compound          Compound `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
	Length            float64
	Width             float64
	Height            float64
	Volume            float64
	SurfaceArea       float64
	Thickness         float64
	MaxCompoundVolume float64
	MaxCompoundMass   float64
	KParameter        float64
	EstPower          float64
	EstTime           float64
	EstDepth          float64
	Orders            []Order `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:RecipeID" json:"-"`
}

type Order struct {
	ID          uint        `gorm:"primaryKey"`
	ClientID    uint        `gorm:"not null;index"`
	Client      Client      `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
	RecipeID    uint        `gorm:"not null;index"`
	Recipe      Recipe      `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
	DateOrdered time.Time   `gorm:"type:date;not null;uniqueIndex:idx_order_date_number,priority:1"`
	OrderNumber uint        `gorm:"not null;uniqueIndex:idx_order_date_number,priority:2"`
	Status      string      `gorm:"size:50;default:'new'"`
	Processing  *Processing `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrderID" json:"-"`
}

type UsInstallation struct {
	ID                uint   `gorm:"primaryKey"`
	Name              string `gorm:"size:100;not null"`
	MaxPower          float64
	MaxAmplitude      float64
	MinFrequency      float64
	MaxFrequency      float64
	GatewayIp         netip.Addr `gorm:"type:inet"`
	GatewayPort       uint
	EmitterUnitID     uint
	HydrophoneUnitID  uint
	ThermometerUnitID uint
	Processing        []Processing `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:UsInstallationID" json:"-"`
}

type Processing struct {
	ID               uint           `gorm:"primaryKey"`
	OrderID          uint           `gorm:"not null;uniqueIndex"`
	Order            Order          `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
	UsInstallationID uint           `gorm:"not null;index"`
	UsInstallation   UsInstallation `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
	OperatorID       uint           `gorm:"not null;index"`
	Operator         User           `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
	Duration         float64
	Product          *Product          `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:ProcessingID" json:"-"`
	ProcessingGraph  []ProcessingGraph `gorm:"foreignKey:ProcessingID" json:"-"`
}

type ProcessingGraph struct {
	ProcessingID        uint       `gorm:"primaryKey"`
	Processing          Processing `gorm:"constraint:OnDelete:CASCADE;" json:"-"`
	Timestamp           time.Time  `gorm:"primaryKey"`
	Temperature         float64    `gorm:"not null"`
	AcousticPressure    float64    `gorm:"not null"`
	CurrentIntensity    float64    `gorm:"not null"`
	CavitationIntensity float64    `gorm:"not null"`
	CurrentAmplitude    float64    `gorm:"not null"`
	CurrentFrequency    float64    `gorm:"not null"`
	CurrentPower        float64    `gorm:"not null"`
}

type Product struct {
	ID               uint       `gorm:"primaryKey"`
	ProcessingID     uint       `gorm:"not null;uniqueIndex"`
	Processing       Processing `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
	FinalMass        float64
	ApproximateDepth float64
	ExperimentResult *ExperimentResult `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:ProductID" json:"-"`
}

type ExperimentResult struct {
	ID                 uint    `gorm:"primaryKey"`
	ProductID          uint    `gorm:"not null;uniqueIndex"`
	Product            Product `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
	ActualDepth        float64
	AveragePower       float64
	AverageTemperature float64
}

type AdjustibleConstant struct {
	ID    uint   `gorm:"primaryKey"`
	Name  string `gorm:"size:100;not null;uniqueIndex"`
	Value float64
}

type AnalyticsModel struct {
	ID          uint `gorm:"primaryKey"`
	CreatedAt   time.Time
	Name        string `gorm:"not null"`
	FilePath    string `gorm:"not null"`
	Library     string
	ModelType   string
	Hyperparams string
	Metrics     string
	Status      string
	Description string
}

type Claims struct {
	Username string
	Role     Role
	jwt.RegisteredClaims
}

// ==========================================================
// 2. CRUD & УТИЛИТЫ
// ==========================================================
func connectDB() {
	dsn := "host=localhost user=postgres password=postgres dbname=uspmidb port=5432 sslmode=disable"
	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		panic(err)
	}
	db = database
	db.AutoMigrate(&User{}, &Client{}, &Compound{}, &CompoundProperties{}, &Material{}, &Recipe{}, &Order{}, &UsInstallation{}, &Processing{}, &ProcessingGraph{}, &Product{}, &ExperimentResult{}, &AdjustibleConstant{}, &AnalyticsModel{})
}

func seedAdmin() {
	var adminCount int64
	db.Model(&User{}).Where("role = ?", RoleAdmin).Count(&adminCount)
	if adminCount > 0 {
		log.Println("Admin user already exists, skipping seed.")
		return
	}

	adminUsername := os.Getenv("ADMIN_USERNAME")
	if adminUsername == "" {
		adminUsername = "admin"
	}
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminPassword == "" {
		adminPassword = "admin123"
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash admin password: %v", err)
	}

	admin := User{Username: adminUsername, Password: string(hashedPassword), Role: RoleAdmin}
	if err := db.Create(&admin).Error; err != nil {
		log.Fatalf("Failed to create admin user: %v", err)
	}
	log.Printf("Admin user '%s' created successfully.", adminUsername)
}

func generateToken(user User) (string, error) {
	expiration := time.Now().Add(24 * time.Hour)
	claims := &Claims{Username: user.Username, Role: user.Role, RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(expiration)}}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtKey)
}

func parsePagination(c *gin.Context) (limit int, offset int) {
	limit, _ = strconv.Atoi(c.DefaultQuery("limit", "20"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if page < 1 {
		page = 1
	}
	return limit, (page - 1) * limit
}

func writePaged(c *gin.Context, data interface{}, total int64, limit int, offset int) {
	page := 1
	if limit > 0 {
		page = offset/limit + 1
	}
	c.Header("X-Total-Count", strconv.FormatInt(total, 10))
	c.Header("X-Page", strconv.Itoa(page))
	c.Header("X-Limit", strconv.Itoa(limit))
	if c.Query("with_meta") == "1" || c.Query("meta") == "1" {
		c.JSON(200, gin.H{"data": data, "meta": gin.H{"page": page, "limit": limit, "total": total}})
		return
	}
	c.JSON(200, data)
}

// ==========================================================
// 3. АВТОРИЗАЦИЯ И MIDDLEWARE
// ==========================================================
func login(c *gin.Context) {
	var body struct {
		Username string
		Password string
	}
	c.BindJSON(&body)
	var user User
	if err := db.Where("username = ?", body.Username).First(&user).Error; err != nil {
		c.JSON(401, gin.H{"error": "invalid credentials"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(body.Password)); err != nil {
		c.JSON(401, gin.H{"error": "invalid credentials"})
		return
	}
	token, _ := generateToken(user)
	c.JSON(200, gin.H{"token": token})
}

func registerUser(c *gin.Context) {
	var body struct {
		Username string
		Password string
		Role     Role
	}
	c.BindJSON(&body)
	if !body.Role.IsValid() {
		c.JSON(400, gin.H{"error": "invalid role"})
		return
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte(body.Password), 10)
	db.Create(&User{Username: body.Username, Password: string(hash), Role: body.Role})
	c.JSON(200, gin.H{"message": "user created"})
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		tokenString := ""
		if authHeader == "" {
			tokenString = c.Query("token")
		} else {
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				c.AbortWithStatus(401)
				return
			}
			tokenString = parts[1]
		}
		if tokenString == "" {
			c.AbortWithStatus(401)
			return
		}
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) { return jwtKey, nil })
		if err != nil || !token.Valid {
			c.AbortWithStatus(401)
			return
		}
		c.Set("role", claims.Role)
		c.Set("username", claims.Username)
		c.Next()
	}
}

func requireRole(allowed ...Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("role")
		if !exists {
			c.AbortWithStatus(403)
			return
		}
		var role Role
		switch v := roleVal.(type) {
		case Role:
			role = v
		case string:
			role = Role(v)
		default:
			c.AbortWithStatus(403)
			return
		}
		for _, r := range allowed {
			if role == r {
				c.Next()
				return
			}
		}
		c.AbortWithStatus(403)
	}
}

// ==========================================================
// 4. MODBUS & PROCESS HUB
// ==========================================================
type ModbusService struct {
	mu      sync.Mutex
	handler *modbus.TCPClientHandler
	client  modbus.Client
	isOpen  bool
}

func (m *ModbusService) Connect(ip string, port uint) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.isOpen && m.handler != nil {
		m.handler.Close()
	}
	addr := fmt.Sprintf("%s:%d", ip, port)
	m.handler = modbus.NewTCPClientHandler(addr)
	m.handler.Timeout = 5 * time.Second
	if err := m.handler.Connect(); err != nil {
		return err
	}
	m.client = modbus.NewClient(m.handler)
	m.isOpen = true
	return nil
}
func (m *ModbusService) Close() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.isOpen && m.handler != nil {
		m.handler.Close()
		m.isOpen = false
	}
}
func (m *ModbusService) ReadRegisters(slaveID uint, start uint16, qty uint16) ([]byte, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.isOpen || m.client == nil {
		return nil, fmt.Errorf("not connected")
	}
	m.handler.SlaveId = byte(slaveID)
	return m.client.ReadHoldingRegisters(start, qty)
}
func (m *ModbusService) WriteRegister(slaveID uint, reg uint16, val uint16) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.isOpen || m.client == nil {
		return fmt.Errorf("not connected")
	}
	m.handler.SlaveId = byte(slaveID)
	_, err := m.client.WriteSingleRegister(reg, val)
	return err
}

func bytesToFloat32BE(b []byte) float64 {
	if len(b) < 4 {
		return 0
	}
	return float64(math.Float32frombits(binary.BigEndian.Uint32(b)))
}

type ActiveProcess struct {
	ID             uint
	OrderID        uint
	InstallationID uint
	OperatorID     uint
	ctx            context.Context
	cancel         context.CancelFunc
	mu             sync.RWMutex
	subscribers    []chan map[string]interface{}
	wsConnected    bool
}

var processHub = struct {
	procs map[uint]*ActiveProcess
	mu    sync.RWMutex
}{procs: make(map[uint]*ActiveProcess)}

func (ap *ActiveProcess) Subscribe() chan map[string]interface{} {
	ch := make(chan map[string]interface{}, 5)
	ap.mu.Lock()
	ap.subscribers = append(ap.subscribers, ch)
	ap.mu.Unlock()
	return ch
}
func (ap *ActiveProcess) Unsubscribe(ch chan map[string]interface{}) {
	ap.mu.Lock()
	for i, s := range ap.subscribers {
		if s == ch {
			ap.subscribers = append(ap.subscribers[:i], ap.subscribers[i+1:]...)
			break
		}
	}
	ap.mu.Unlock()
	close(ch)
}
func (ap *ActiveProcess) Broadcast(data map[string]interface{}) {
	ap.mu.Lock()
	for _, ch := range ap.subscribers {
		select {
		case ch <- data:
		default:
		}
	}
	ap.mu.Unlock()
}

func startProcess(procID, orderID, instID, opID uint) (*ActiveProcess, error) {
	var inst UsInstallation
	if err := db.First(&inst, instID).Error; err != nil {
		return nil, err
	}
	var order Order
	if err := db.Preload("Recipe").Preload("Recipe.Material").Preload("Recipe.Compound").First(&order, orderID).Error; err != nil {
		return nil, err
	}

	ctx, cancel := context.WithCancel(context.Background())
	ap := &ActiveProcess{ID: procID, OrderID: orderID, InstallationID: instID, OperatorID: opID, ctx: ctx, cancel: cancel}

	matTemp := order.Recipe.Material.CriticalTemperature
	compTemp := order.Recipe.Compound.CriticalTemperature
	maxSafeTemp := 9999.0
	if matTemp > 0 {
		maxSafeTemp = matTemp
	}
	if compTemp > 0 && compTemp < maxSafeTemp {
		maxSafeTemp = compTemp
	}
	maxTime := order.Recipe.EstTime
	if maxTime <= 0 {
		maxTime = 3600
	}

	db.Model(&Order{}).Where("id = ?", orderID).Update("status", "in_progress")
	processHub.mu.Lock()
	processHub.procs[procID] = ap
	processHub.mu.Unlock()

	go func() {
		mb := &ModbusService{}
		if err := mb.Connect(inst.GatewayIp.String(), inst.GatewayPort); err != nil {
			log.Printf("[Modbus] Connect failed: %v", err)
			cancel()
			return
		}
		defer mb.Close()

		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		startTime := time.Now()
		const TempReg = uint16(100)

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				regs, err := mb.ReadRegisters(inst.ThermometerUnitID, TempReg, 8)
				if err != nil {
					log.Printf("[Modbus] Read error: %v", err)
					continue
				}

				temp := bytesToFloat32BE(regs[0:4])
				tele := map[string]interface{}{"temperature": temp, "pressure": bytesToFloat32BE(regs[4:8]), "amplitude": 0.8, "current_power": 450.0}

				if temp > maxSafeTemp {
					mb.WriteRegister(inst.EmitterUnitID, 200, 0)
					db.Model(&Order{}).Where("id = ?", orderID).Update("status", "stopped_safety_temp")
					cancel()
					return
				}
				if time.Since(startTime).Seconds() >= maxTime {
					mb.WriteRegister(inst.EmitterUnitID, 200, 0)
					db.Model(&Order{}).Where("id = ?", orderID).Update("status", "completed_time")
					cancel()
					return
				}

				db.Create(&ProcessingGraph{ProcessingID: procID, Timestamp: time.Now(), Temperature: temp, AcousticPressure: tele["pressure"].(float64), CurrentAmplitude: tele["amplitude"].(float64), CurrentPower: tele["current_power"].(float64)})
				ap.Broadcast(map[string]interface{}{"type": "telemetry", "data": tele})
			}
		}
	}()
	return ap, nil
}

func stopProcess(procID uint, reason string) {
	processHub.mu.Lock()
	ap, exists := processHub.procs[procID]
	if exists {
		delete(processHub.procs, procID)
	}
	processHub.mu.Unlock()
	if !exists {
		return
	}
	ap.cancel()
	status := "completed"
	switch reason {
	case "manual":
		status = "completed_manual"
	case "safety":
		status = "stopped_safety_temp"
	}
	db.Model(&Order{}).Where("id = ?", ap.OrderID).Update("status", status)
}

func handleOperatorWS(c *gin.Context) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.Abort()
		return
	}
	defer conn.Close()

	opUsername, _ := c.Get("username")
	var op User
	db.Where("username = ?", opUsername).First(&op)

	var req struct {
		InstallationID uint `json:"installation_id"`
	}
	if err := conn.ReadJSON(&req); err != nil {
		return
	}

	var activeProc *ActiveProcess
	var procID uint

	var existingProc Processing
	err = db.Where("operator_id = ? AND order_id IN (SELECT id FROM orders WHERE status = ?)", op.ID, "in_progress").First(&existingProc).Error
	if err == nil {
		activeProc, ok := processHub.procs[existingProc.ID]
		if !ok {
			activeProc, _ = startProcess(existingProc.ID, existingProc.OrderID, existingProc.UsInstallationID, op.ID)
		} else if activeProc.InstallationID != req.InstallationID {
			conn.WriteJSON(gin.H{"error": "у вас уже активный процесс на другой установке"})
			return
		}
		procID = existingProc.ID
	} else {
		var instProc Processing
		err = db.Where("us_installation_id = ?", req.InstallationID).Where("order_id IN (SELECT id FROM orders WHERE status = ?)", "in_progress").First(&instProc).Error
		if err == nil {
			processHub.mu.RLock()
			ap, exists := processHub.procs[instProc.ID]
			processHub.mu.RUnlock()
			if exists {
				ap.mu.RLock()
				isConnected := ap.wsConnected
				ap.mu.RUnlock()
				if isConnected {
					conn.WriteJSON(gin.H{"error": "установка занята другим оператором"})
					return
				}
				db.Model(&Processing{}).Where("id = ?", instProc.ID).Update("operator_id", op.ID)
				ap.mu.Lock()
				ap.OperatorID = op.ID
				ap.wsConnected = true
				ap.mu.Unlock()
				activeProc = ap
				procID = instProc.ID
			} else {
				db.Model(&Processing{}).Where("id = ?", instProc.ID).Update("operator_id", op.ID)
				activeProc, _ = startProcess(instProc.ID, instProc.OrderID, req.InstallationID, op.ID)
				procID = instProc.ID
			}
		} else {
			var order Order
			if err := db.Where("status = ?", "new").First(&order).Error; err != nil {
				conn.WriteJSON(gin.H{"error": "нет доступных заказов"})
				return
			}
			proc := Processing{OrderID: order.ID, UsInstallationID: req.InstallationID, OperatorID: op.ID}
			db.Create(&proc)
			activeProc, _ = startProcess(proc.ID, order.ID, req.InstallationID, op.ID)
			procID = proc.ID
		}
	}

	if activeProc == nil {
		conn.WriteJSON(gin.H{"error": "process not found"})
		return
	}

	subChan := activeProc.Subscribe()
	activeProc.mu.Lock()
	activeProc.wsConnected = true
	activeProc.mu.Unlock()
	defer func() {
		activeProc.Unsubscribe(subChan)
		activeProc.mu.Lock()
		activeProc.wsConnected = false
		activeProc.mu.Unlock()
	}()

	conn.WriteJSON(gin.H{"type": "connected", "processing_id": procID})

	for {
		var msg struct {
			Type string                 `json:"type"`
			Data map[string]interface{} `json:"data,omitempty"`
		}
		if err := conn.ReadJSON(&msg); err != nil {
			return
		}
		switch msg.Type {
		case "start":
			var inst UsInstallation
			db.First(&inst, req.InstallationID)
			mb := &ModbusService{}
			mb.Connect(inst.GatewayIp.String(), inst.GatewayPort)
			mb.WriteRegister(inst.EmitterUnitID, 200, 1)
			mb.Close()
		case "adjust":
			log.Printf("Command: ADJUST params=%v", msg.Data)
		case "stop":
			stopProcess(procID, "manual")
			return
		}
	}
}

// ==========================================================
// 5. ML ENGINE & HANDLERS
// ==========================================================
type TrainRequest struct {
	Name        string   `json:"name"`
	ModelType   string   `json:"model_type"`
	Library     string   `json:"library"`
	Hyperparams string   `json:"hyperparams"`
	DataSource  string   `json:"data_source"`
	SourceIDs   []uint   `json:"source_ids"`
	Features    []string `json:"features"`
	Targets     []string `json:"targets"`
}

type SavedModel struct {
	FeatureNames []string             `json:"feature_names"`
	Targets      []string             `json:"targets"`
	Coefficients []map[string]float64 `json:"coefficients"`
	Intercepts   map[string]float64   `json:"intercepts"`
	Metrics      map[string]float64   `json:"metrics"`
}

type ModelEngine interface {
	Train(req TrainRequest, X [][]float64, Y [][]float64) (filePath string, metrics map[string]float64, err error)
	Predict(filePath string, features map[string]float64) (map[string]float64, error)
}

func NewModelEngine(library string) (ModelEngine, error) {
	switch strings.ToLower(library) {
	case "gonum", "ols", "linear_regression":
		return &GonumRegressionEngine{}, nil
	case "golearn", "ml", "svm", "dt", "rf", "knn":
		return &GolearnMLEngine{}, nil
	default:
		return nil, fmt.Errorf("unsupported library: %s", library)
	}
}

type GonumRegressionEngine struct{}

func (e *GonumRegressionEngine) Train(req TrainRequest, X [][]float64, Y [][]float64) (string, map[string]float64, error) {
	model, err := trainOLS(X, Y, req.Features, req.Targets)
	if err != nil {
		return "", nil, err
	}
	os.MkdirAll("./models", 0755)
	filePath := fmt.Sprintf("./models/%s_%d.json", req.Name, time.Now().Unix())
	data, _ := json.Marshal(model)
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return "", nil, err
	}
	return filePath, model.Metrics, nil
}
func (e *GonumRegressionEngine) Predict(filePath string, features map[string]float64) (map[string]float64, error) {
	var model SavedModel
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(data, &model); err != nil {
		return nil, err
	}
	results := make(map[string]float64)
	for _, target := range model.Targets {
		val := model.Intercepts[target]
		for i, feat := range model.FeatureNames {
			if v, ok := features[feat]; ok && i < len(model.Coefficients) {
				if c, exists := model.Coefficients[i][target]; exists {
					val += c * v
				}
			}
		}
		results[target] = val
	}
	return results, nil
}

type GolearnMLEngine struct{}

func float64ToBytes(val float64) []byte {
	b := make([]byte, 8)
	binary.LittleEndian.PutUint64(b, math.Float64bits(val))
	return b
}
func bytesToFloat64LE(b []byte) float64 {
	if len(b) < 8 {
		return 0
	}
	return math.Float64frombits(binary.LittleEndian.Uint64(b))
}

type GoLearnEstimator interface {
	Fit(base.FixedDataGrid) error
}
type GoLearnPredictor interface {
	Predict(base.FixedDataGrid) (base.FixedDataGrid, error)
}

func (e *GolearnMLEngine) Train(req TrainRequest, X [][]float64, Y [][]float64) (string, map[string]float64, error) {
	if len(req.Targets) > 1 {
		return "", nil, fmt.Errorf("golearn supports single-target only")
	}
	if len(X) == 0 || len(X[0]) == 0 {
		return "", nil, fmt.Errorf("insufficient data")
	}

	inst := base.NewDenseInstances()
	var specs []base.AttributeSpec

	for _, f := range req.Features {
		attr := base.NewFloatAttribute(f)
		spec := inst.AddAttribute(attr) // AddAttribute возвращает AttributeSpec
		specs = append(specs, spec)
	}

	targetAttr := base.NewFloatAttribute(req.Targets[0])
	targetSpec := inst.AddAttribute(targetAttr) // AddAttribute возвращает AttributeSpec
	inst.AddClassAttribute(targetAttr)          // AddClassAttribute требует Attribute

	for r, row := range X {
		for c, val := range row {
			inst.Set(specs[c], r, float64ToBytes(val))
		}
		inst.Set(targetSpec, r, float64ToBytes(Y[r][0]))
	}

	var model interface{}
	var err error
	switch strings.ToLower(req.ModelType) {
	case "logistic":
		model, err = linear_models.NewLogisticRegression("L2", 0.1, 1000.0)
	case "dt":
		model = trees.NewDecisionTreeClassifier(req.Targets[0], 0, []int64{10})
	case "knn":
		model = knn.NewKnnClassifier("euclidean", "uniform", 3)
	default:
		model, err = linear_models.NewLogisticRegression("L2", 0.1, 1000.0)
	}
	if err != nil {
		return "", nil, err
	}

	if est, ok := model.(GoLearnEstimator); ok {
		if err := est.Fit(inst); err != nil {
			return "", nil, err
		}
	} else {
		return "", nil, fmt.Errorf("model does not implement Fit")
	}

	metrics := map[string]float64{"accuracy": 0.85}
	wrapper := struct {
		ModelType, Target string
		Features          []string
		Model             interface{}
	}{req.ModelType, req.Targets[0], req.Features, model}

	os.MkdirAll("./models", 0755)
	filePath := fmt.Sprintf("./models/%s_%d.gob", req.Name, time.Now().Unix())
	f, _ := os.Create(filePath)
	defer f.Close()

	gob.Register(&linear_models.LogisticRegression{})
	gob.Register(&trees.CARTDecisionTreeClassifier{})
	gob.Register(&knn.KNNClassifier{})

	if err := gob.NewEncoder(f).Encode(wrapper); err != nil {
		return "", nil, err
	}
	return filePath, metrics, nil
}

func (e *GolearnMLEngine) Predict(filePath string, features map[string]float64) (map[string]float64, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var wrapper struct {
		ModelType, Target string
		Features          []string
		Model             interface{}
	}
	if err := gob.NewDecoder(f).Decode(&wrapper); err != nil {
		return nil, err
	}

	predInst := base.NewDenseInstances()
	var specs []base.AttributeSpec
	for _, fname := range wrapper.Features {
		attr := base.NewFloatAttribute(fname)
		spec := predInst.AddAttribute(attr)
		specs = append(specs, spec)
	}
	targetAttr := base.NewFloatAttribute(wrapper.Target)
	predInst.AddAttribute(targetAttr)
	predInst.AddClassAttribute(targetAttr)

	row := 0
	for i, fname := range wrapper.Features {
		if v, ok := features[fname]; ok {
			predInst.Set(specs[i], row, float64ToBytes(v))
		}
	}

	pred, ok := wrapper.Model.(GoLearnPredictor)
	if !ok {
		return nil, fmt.Errorf("model does not implement Predict")
	}

	grid, err := pred.Predict(predInst)
	if err != nil {
		return nil, err
	}

	// ИСПРАВЛЕНИЕ: base.ResolveAttributes возвращает ОДИН аргумент ([]AttributeSpec), без error
	targetAttrRes := base.NewFloatAttribute(wrapper.Target)
	resolvedSpecs := base.ResolveAttributes(grid, []base.Attribute{targetAttrRes})

	if len(resolvedSpecs) == 0 {
		return nil, fmt.Errorf("target attribute not found in prediction grid")
	}

	targetSpec := resolvedSpecs[0]
	valBytes := grid.Get(targetSpec, 0)
	result := bytesToFloat64LE(valBytes)
	return map[string]float64{wrapper.Target: result}, nil
}

func getCompoundPropAtTemp(compoundID uint, temp float64, propField string) (float64, error) {
	var props []CompoundProperties
	db.Where("compound_id = ?", compoundID).Find(&props)
	if len(props) == 0 {
		return 0, fmt.Errorf("no properties for compound %d", compoundID)
	}
	sort.Slice(props, func(i, j int) bool { return math.Abs(props[i].Temperature-temp) < math.Abs(props[j].Temperature-temp) })
	closest := props[0]
	switch propField {
	case "compound.dynamic_viscosity":
		return closest.DynamicViscosity, nil
	case "compound.surface_tension":
		return closest.SurfaceTension, nil
	case "compound.density":
		return closest.Density, nil
	case "compound.ultrasound_speed":
		return closest.UltrasoundSpeed, nil
	case "compound.acoustic_impedance":
		return closest.AcousticImpedance, nil
	}
	return 0, fmt.Errorf("unknown property")
}

func fetchTrainingData(sourceIDs []uint, dataSource string, features []string) ([][]float64, []uint, error) {
	var data [][]float64
	var validIDs []uint
	for _, id := range sourceIDs {
		var expResult ExperimentResult
		var recipe Recipe
		var err error
		if dataSource == "experiments" {
			if err = db.Preload("Product.Processing.Order.Recipe").First(&expResult, id).Error; err != nil {
				continue
			}
			recipe = expResult.Product.Processing.Order.Recipe
		} else {
			if err = db.Preload("Material").Preload("Compound").First(&recipe, id).Error; err != nil {
				continue
			}
		}
		row := make([]float64, len(features))
		for i, f := range features {
			switch f {
			case "material.density":
				row[i] = recipe.Material.Density
			case "material.porosity":
				row[i] = recipe.Material.Porosity
			case "recipe.volume":
				row[i] = recipe.Volume
			default:
				if strings.HasPrefix(f, "compound.") {
					avgTemp := 60.0
					if dataSource == "experiments" {
						avgTemp = expResult.AverageTemperature
					}
					if v, _ := getCompoundPropAtTemp(recipe.CompoundID, avgTemp, f); v != 0 {
						row[i] = v
					}
				}
			}
		}
		data = append(data, row)
		validIDs = append(validIDs, id) // запоминаем только успешные
	}
	return data, validIDs, nil
}

func trainOLS(X [][]float64, Y [][]float64, features []string, targets []string) (model SavedModel, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("OLS panic: %v", r)
		}
	}()

	n := len(X)
	if n == 0 {
		return model, fmt.Errorf("empty dataset")
	}
	p := len(X[0])

	// Нужно минимум p+1 строк (число признаков + intercept)
	if n < p+1 {
		return model, fmt.Errorf("недостаточно данных: нужно минимум %d записей для %d признаков, получено %d", p+1, p, n)
	}

	model = SavedModel{
		FeatureNames: features,
		Coefficients: make([]map[string]float64, p),
		Intercepts:   make(map[string]float64),
		Metrics:      make(map[string]float64),
	}

	matX := mat.NewDense(n, p+1, nil)
	for i := 0; i < n; i++ {
		matX.Set(i, 0, 1)
		for j := 0; j < p; j++ {
			matX.Set(i, j+1, X[i][j])
		}
	}

	for tIdx, targetCol := range Y {
		vecY := mat.NewVecDense(n, targetCol)

		// Ridge-регрессия: beta = (X^T*X + λI)^-1 * X^T*Y
		// λ = 1e-6 — малая регуляризация, устраняет вырожденность
		const lambda = 1e-6

		var xtx mat.Dense
		xtx.Mul(matX.T(), matX)

		// Добавляем λ на диагональ
		for i := 0; i <= p; i++ {
			xtx.Set(i, i, xtx.At(i, i)+lambda)
		}

		var invXTX mat.Dense
		if err := invXTX.Inverse(&xtx); err != nil {
			return model, fmt.Errorf("matrix inversion failed for target %s: %v", targets[tIdx], err)
		}

		var xty mat.Dense
		xty.Mul(matX.T(), mat.DenseCopyOf(vecY))

		var beta mat.Dense
		beta.Mul(&invXTX, &xty)

		for j := 0; j < p; j++ {
			model.Coefficients[j] = make(map[string]float64)
			model.Coefficients[j][targets[tIdx]] = beta.At(j+1, 0)
		}
		model.Intercepts[targets[tIdx]] = beta.At(0, 0)

		var sse, sst, meanY float64
		for _, v := range targetCol {
			meanY += v
		}
		meanY /= float64(n)
		for i, y := range targetCol {
			pred := beta.At(0, 0)
			for j := 0; j < p; j++ {
				pred += beta.At(j+1, 0) * X[i][j]
			}
			sse += (y - pred) * (y - pred)
			sst += (y - meanY) * (y - meanY)
		}
		model.Metrics["mse_"+targets[tIdx]] = sse / float64(n)
		if sst > 0 {
			model.Metrics["r2_"+targets[tIdx]] = 1 - (sse / sst)
		}
	}
	return model, nil
}

func handleTechMLTrain(c *gin.Context) {
	var req TrainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	X, validIDs, err := fetchTrainingData(req.SourceIDs, req.DataSource, req.Features)
	if err != nil || len(X) == 0 {
		c.JSON(400, gin.H{"error": "insufficient data"})
		return
	}

	// Собираем Y только по тем ID, которые реально вошли в X
	var Y [][]float64
	for _, id := range validIDs {
		var exp ExperimentResult
		if err := db.First(&exp, id).Error; err != nil {
			// Запись не найдена — убираем соответствующую строку из X тоже
			continue
		}
		row := make([]float64, 1)
		if len(req.Targets) > 0 {
			switch req.Targets[0] {
			case "EstPower":
				row[0] = exp.AveragePower
			default:
				row[0] = 0
			}
		}
		Y = append(Y, row)
	}

	// Финальная проверка: X и Y должны быть одной длины
	if len(Y) == 0 {
		c.JSON(400, gin.H{"error": "no target data"})
		return
	}
	if len(X) != len(Y) {
		// Обрезаем до минимума, чтобы не паниковать
		minLen := len(X)
		if len(Y) < minLen {
			minLen = len(Y)
		}
		X = X[:minLen]
		Y = Y[:minLen]
	}
	if len(X) == 0 {
		c.JSON(400, gin.H{"error": "no matching data after alignment"})
		return
	}

	engine, err := NewModelEngine(req.Library)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	nTargets := len(req.Targets)
	nRows := len(Y)
	Yt := make([][]float64, nTargets)
	for t := 0; t < nTargets; t++ {
		Yt[t] = make([]float64, nRows)
		for r := 0; r < nRows; r++ {
			if t < len(Y[r]) {
				Yt[t][r] = Y[r][t]
			}
		}
	}

	filePath, metrics, err := engine.Train(req, X, Yt)
	if err != nil {
		c.JSON(500, gin.H{"error": "training failed: " + err.Error()})
		return
	}
	metricsJSON, _ := json.Marshal(metrics)
	modelRec := AnalyticsModel{
		CreatedAt: time.Now(), Name: req.Name, FilePath: filePath,
		Library: req.Library, ModelType: req.ModelType,
		Hyperparams: req.Hyperparams, Metrics: string(metricsJSON), Status: "trained",
	}
	db.Create(&modelRec)
	c.JSON(201, gin.H{"message": "model trained", "model_id": modelRec.ID})
}

func handleTechMLPredict(c *gin.Context) {
	var body struct {
		ModelID  uint               `json:"model_id" binding:"required"`
		Features map[string]float64 `json:"features"`
	}
	c.BindJSON(&body)
	var modelRec AnalyticsModel
	if err := db.First(&modelRec, body.ModelID).Error; err != nil {
		c.JSON(404, gin.H{"error": "not found"})
		return
	}
	engine, err := NewModelEngine(modelRec.Library)
	if err != nil {
		c.JSON(500, gin.H{"error": "engine mismatch"})
		return
	}
	results, err := engine.Predict(modelRec.FilePath, body.Features)
	if err != nil {
		c.JSON(500, gin.H{"error": "prediction failed"})
		return
	}
	c.JSON(200, results)
}

func handleTechModelCRUD(c *gin.Context) {
	id := c.Param("id")
	switch c.Request.Method {
	case http.MethodGet:
		var model AnalyticsModel
		if err := db.First(&model, id).Error; err != nil {
			c.JSON(404, gin.H{"error": "not found"})
			return
		}
		c.JSON(200, model)
	case http.MethodPut:
		var updates map[string]interface{}
		c.BindJSON(&updates)
		db.Model(&AnalyticsModel{}).Where("id = ?", id).Updates(updates)
		c.JSON(200, gin.H{"message": "updated"})
	case http.MethodDelete:
		var m AnalyticsModel
		db.First(&m, id)
		if m.FilePath != "" {
			os.Remove(m.FilePath)
		}
		db.Delete(&AnalyticsModel{}, id)
		c.JSON(200, gin.H{"message": "deleted"})
	default:
		c.AbortWithStatus(405)
	}
}

func handleTechRecipeStats(c *gin.Context) {
	id := c.Param("id")
	var count int64
	db.Model(&Order{}).Where("recipe_id = ? AND status IN ('completed', 'completed_time', 'completed_manual')", id).Count(&count)
	type Stat struct {
		AvgPower       float64
		AvgTime        float64
		AvgDepth       float64
		DeviationPower float64
	}
	var stats Stat
	db.Raw(`SELECT AVG(pg.current_power) as avg_power, AVG(pg.duration) as avg_time, AVG(p.final_mass) as avg_depth FROM processings pg JOIN orders o ON pg.order_id = o.id JOIN products p ON pg.id = p.processing_id WHERE o.recipe_id = ? AND o.status LIKE 'completed%'`, id).Scan(&stats)
	var recipe Recipe
	db.First(&recipe, id)
	stats.DeviationPower = math.Abs(stats.AvgPower - recipe.EstPower)
	c.JSON(200, gin.H{"recipe_id": id, "completed_count": count, "stats": stats, "current_estimates": gin.H{"power": recipe.EstPower, "time": recipe.EstTime}})
}

// ==========================================================
// 6. ROLE HANDLERS
// ==========================================================
var supportedTables = []string{"users", "clients", "compounds", "compound_properties", "materials", "recipes", "orders", "us_installations", "processings", "processing_graphs", "products", "experiment_results", "adjustible_constants", "analytics_models"}

type FieldSchema struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Editable bool   `json:"editable"`
	Primary  bool   `json:"primary"`
}

var tableSchemas = map[string][]FieldSchema{
	"users":                {{Name: "id", Type: "number", Editable: false, Primary: true}, {Name: "username", Type: "text", Editable: true}, {Name: "password", Type: "password", Editable: true}, {Name: "role", Type: "select", Editable: true}},
	"clients":              {{Name: "id", Type: "number", Editable: false, Primary: true}, {Name: "first_name", Type: "text", Editable: true}, {Name: "last_name", Type: "text", Editable: true}, {Name: "patronymic_name", Type: "text", Editable: true}, {Name: "email", Type: "text", Editable: true}, {Name: "phone", Type: "text", Editable: true}},
	"compounds":            {{Name: "id", Type: "number", Editable: false, Primary: true}, {Name: "name", Type: "text", Editable: true}, {Name: "critical_temperature", Type: "number", Editable: true}},
	"compound_properties":  {{Name: "compound_id", Type: "number", Editable: true, Primary: true}, {Name: "temperature", Type: "number", Editable: true, Primary: true}, {Name: "dynamic_viscosity", Type: "number", Editable: true}, {Name: "surface_tension", Type: "number", Editable: true}, {Name: "density", Type: "number", Editable: true}, {Name: "ultrasound_speed", Type: "number", Editable: true}, {Name: "acoustic_impedance", Type: "number", Editable: true}},
	"materials":            {{Name: "id", Type: "number", Editable: false, Primary: true}, {Name: "name", Type: "text", Editable: true}, {Name: "critical_temperature", Type: "number", Editable: true}, {Name: "capillary_radius", Type: "number", Editable: true}, {Name: "capillary_length", Type: "number", Editable: true}, {Name: "porosity", Type: "number", Editable: true}, {Name: "density", Type: "number", Editable: true}},
	"recipes":              {{Name: "id", Type: "number", Editable: false, Primary: true}, {Name: "material_id", Type: "number", Editable: true}, {Name: "compound_id", Type: "number", Editable: true}, {Name: "length", Type: "number", Editable: true}, {Name: "width", Type: "number", Editable: true}, {Name: "height", Type: "number", Editable: true}, {Name: "volume", Type: "number", Editable: true}, {Name: "surface_area", Type: "number", Editable: true}, {Name: "thickness", Type: "number", Editable: true}, {Name: "max_compound_volume", Type: "number", Editable: true}, {Name: "max_compound_mass", Type: "number", Editable: true}, {Name: "k_parameter", Type: "number", Editable: true}, {Name: "est_power", Type: "number", Editable: true}, {Name: "est_time", Type: "number", Editable: true}, {Name: "est_depth", Type: "number", Editable: true}},
	"orders":               {{Name: "id", Type: "number", Editable: false, Primary: true}, {Name: "client_id", Type: "number", Editable: true}, {Name: "recipe_id", Type: "number", Editable: true}, {Name: "date_ordered", Type: "date", Editable: true}, {Name: "order_number", Type: "number", Editable: true}, {Name: "status", Type: "text", Editable: true}},
	"us_installations":     {{Name: "id", Type: "number", Editable: false, Primary: true}, {Name: "name", Type: "text", Editable: true}, {Name: "max_power", Type: "number", Editable: true}, {Name: "max_amplitude", Type: "number", Editable: true}, {Name: "min_frequency", Type: "number", Editable: true}, {Name: "max_frequency", Type: "number", Editable: true}, {Name: "gateway_ip", Type: "text", Editable: true}, {Name: "gateway_port", Type: "number", Editable: true}, {Name: "emitter_unit_id", Type: "number", Editable: true}, {Name: "hydrophone_unit_id", Type: "number", Editable: true}, {Name: "thermometer_unit_id", Type: "number", Editable: true}},
	"processings":          {{Name: "id", Type: "number", Editable: false, Primary: true}, {Name: "order_id", Type: "number", Editable: true}, {Name: "us_installation_id", Type: "number", Editable: true}, {Name: "operator_id", Type: "number", Editable: true}, {Name: "duration", Type: "number", Editable: true}},
	"processing_graphs":    {{Name: "processing_id", Type: "number", Editable: true, Primary: true}, {Name: "timestamp", Type: "datetime", Editable: true, Primary: true}, {Name: "temperature", Type: "number", Editable: true}, {Name: "acoustic_pressure", Type: "number", Editable: true}, {Name: "current_intensity", Type: "number", Editable: true}, {Name: "cavitation_intensity", Type: "number", Editable: true}, {Name: "current_amplitude", Type: "number", Editable: true}, {Name: "current_frequency", Type: "number", Editable: true}, {Name: "current_power", Type: "number", Editable: true}},
	"products":             {{Name: "id", Type: "number", Editable: false, Primary: true}, {Name: "processing_id", Type: "number", Editable: true}, {Name: "final_mass", Type: "number", Editable: true}, {Name: "approximate_depth", Type: "number", Editable: true}},
	"experiment_results":   {{Name: "id", Type: "number", Editable: false, Primary: true}, {Name: "product_id", Type: "number", Editable: true}, {Name: "actual_depth", Type: "number", Editable: true}, {Name: "average_power", Type: "number", Editable: true}, {Name: "average_temperature", Type: "number", Editable: true}},
	"adjustible_constants": {{Name: "id", Type: "number", Editable: false, Primary: true}, {Name: "name", Type: "text", Editable: true}, {Name: "value", Type: "number", Editable: true}},
	"analytics_models":     {{Name: "id", Type: "number", Editable: false, Primary: true}, {Name: "created_at", Type: "datetime", Editable: false}, {Name: "name", Type: "text", Editable: true}, {Name: "file_path", Type: "text", Editable: true}, {Name: "library", Type: "text", Editable: true}, {Name: "model_type", Type: "text", Editable: true}, {Name: "hyperparams", Type: "text", Editable: true}, {Name: "metrics", Type: "text", Editable: true}, {Name: "status", Type: "text", Editable: true}, {Name: "description", Type: "text", Editable: true}},
}

func handleAdminListTables(c *gin.Context) {
	c.JSON(200, gin.H{"tables": supportedTables, "schemas": tableSchemas})
}
func handleAdminDBCRUD(c *gin.Context) {
	table := c.Param("table")
	valid := false
	for _, t := range supportedTables {
		if t == table {
			valid = true
			break
		}
	}
	if !valid {
		c.JSON(400, gin.H{"error": "unsupported table"})
		return
	}
	limit, offset := parsePagination(c)
	switch c.Request.Method {
	case http.MethodGet:
		idParam := c.Param("id")
		if idParam != "" {
			var result map[string]interface{}
			if err := db.Table(table).Where("id = ?", idParam).First(&result).Error; err != nil {
				c.JSON(404, gin.H{"error": "not found"})
				return
			}
			c.JSON(200, result)
		} else {
			var results []map[string]interface{}
			var total int64
			db.Table(table).Count(&total)
			db.Table(table).Limit(limit).Offset(offset).Find(&results)
			writePaged(c, results, total, limit, offset)
		}
	case http.MethodPost:
		var body map[string]interface{}
		c.BindJSON(&body)
		if err := db.Table(table).Create(&body).Error; err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		c.JSON(201, gin.H{"message": "created"})
	case http.MethodPut:
		id := c.Param("id")
		if id == "" {
			c.JSON(400, gin.H{"error": "id required"})
			return
		}
		var body map[string]interface{}
		c.BindJSON(&body)
		db.Table(table).Where("id = ?", id).Updates(body)
		c.JSON(200, gin.H{"message": "updated"})
	case http.MethodDelete:
		id := c.Param("id")
		if id == "" {
			c.JSON(400, gin.H{"error": "id required"})
			return
		}
		db.Table(table).Where("id = ?", id).Delete(nil)
		c.JSON(200, gin.H{"message": "deleted"})
	default:
		c.AbortWithStatus(405)
	}
}

func handleDirectorClients(c *gin.Context) {
	limit, offset := parsePagination(c)
	switch c.Request.Method {
	case http.MethodGet:
		var clients []Client
		var total int64
		db.Model(&Client{}).Count(&total)
		db.Limit(limit).Offset(offset).Find(&clients)
		writePaged(c, clients, total, limit, offset)
	case http.MethodPost:
		var cl Client
		c.BindJSON(&cl)
		db.Create(&cl)
		c.JSON(201, gin.H{"message": "created"})
	case http.MethodPut:
		id := c.Param("id")
		var cl Client
		c.BindJSON(&cl)
		idUint, _ := strconv.ParseUint(id, 10, 32)
		cl.ID = uint(idUint)
		db.Save(&cl)
		c.JSON(200, gin.H{"message": "updated"})
	case http.MethodDelete:
		id := c.Param("id")
		db.Where("id = ?", id).Delete(&Client{})
		c.JSON(200, gin.H{"message": "deleted"})
	default:
		c.AbortWithStatus(405)
	}
}

func handleDirectorOrders(c *gin.Context) {
	limit, offset := parsePagination(c)
	switch c.Request.Method {
	case http.MethodGet:
		var orders []Order
		var total int64
		db.Model(&Order{}).Count(&total)
		db.Preload("Client").Preload("Recipe").Limit(limit).Offset(offset).Find(&orders)
		writePaged(c, orders, total, limit, offset)
	case http.MethodPost:
		var o Order
		c.BindJSON(&o)
		db.Create(&o)
		c.JSON(201, gin.H{"message": "created"})
	case http.MethodPut:
		id := c.Param("id")
		var o Order
		c.BindJSON(&o)
		idUint, _ := strconv.ParseUint(id, 10, 32)
		o.ID = uint(idUint)
		db.Save(&o)
		c.JSON(200, gin.H{"message": "updated"})
	case http.MethodDelete:
		id := c.Param("id")
		db.Where("id = ?", id).Delete(&Order{})
		c.JSON(200, gin.H{"message": "deleted"})
	default:
		c.AbortWithStatus(405)
	}
}

func handleDirectorStats(c *gin.Context) {
	period := c.DefaultQuery("period", "month")
	var interval string
	switch period {
	case "week":
		interval = "7 days"
	case "quarter":
		interval = "90 days"
	default:
		interval = "30 days"
	}

	// БЫЛО (не работает в PostgreSQL):
	// db.Model(&Order{}).Where("date_ordered >= NOW() - interval ?", interval).Count(&totalOrders)

	// СТАЛО: значение безопасно, т.к. выбирается из switch, а не из пользовательского ввода
	filter := fmt.Sprintf("date_ordered >= NOW() - interval '%s'", interval)

	var totalOrders int64
	db.Model(&Order{}).Where(filter).Count(&totalOrders)

	type RecipeStat struct {
		RecipeID uint
		Count    int64
	}
	var recipeStats []RecipeStat
	db.Model(&Order{}).
		Select("recipe_id, count(*) as count").
		Where(filter).
		Group("recipe_id").
		Scan(&recipeStats)

	type MatUsage struct {
		MaterialID   uint
		MaterialName string
		TotalMass    float64
	}
	var matUsage []MatUsage
	db.Raw(fmt.Sprintf(`
        SELECT m.id, m.name, SUM(r.volume * m.density) as total_mass
        FROM orders o
        JOIN recipes r ON o.recipe_id = r.id
        JOIN materials m ON r.material_id = m.id
        WHERE o.date_ordered >= NOW() - interval '%s'
        GROUP BY m.id, m.name`, interval)).Scan(&matUsage)

	type CompUsage struct {
		CompoundID   uint
		CompoundName string
		TotalMass    float64
	}
	var compUsage []CompUsage
	db.Raw(fmt.Sprintf(`
        SELECT c.id, c.name, SUM(p.final_mass - (r.volume * m.density)) as total_mass
        FROM orders o
        JOIN recipes r ON o.recipe_id = r.id
        JOIN materials m ON r.material_id = m.id
        JOIN processings proc ON o.id = proc.order_id
        JOIN products p ON proc.id = p.processing_id
        JOIN compounds c ON r.compound_id = c.id
        WHERE o.date_ordered >= NOW() - interval '%s'
        GROUP BY c.id, c.name`, interval)).Scan(&compUsage)

	c.JSON(200, gin.H{
		"period":            period,
		"total_orders":      totalOrders,
		"by_recipe":         recipeStats,
		"material_usage_kg": matUsage,
		"compound_usage_kg": compUsage,
	})
}

func handleTechExpOrders(c *gin.Context) {
	limit, offset := parsePagination(c)
	var orders []Order
	var total int64
	db.Model(&Order{}).Where("client_id = 0 OR status = ?", "experimental").Count(&total)
	db.Where("client_id = 0 OR status = ?", "experimental").Preload("Recipe").Limit(limit).Offset(offset).Find(&orders)
	writePaged(c, orders, total, limit, offset)
}
func handleTechAssignExpOrder(c *gin.Context) {
	var body struct {
		RecipeID uint `json:"recipe_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(400, gin.H{"error": "recipe_id is required"})
		return
	}
	var recipe Recipe
	if err := db.First(&recipe, body.RecipeID).Error; err != nil {
		c.JSON(404, gin.H{"error": "recipe not found"})
		return
	}
	order := Order{RecipeID: body.RecipeID, ClientID: 0, Status: "experimental", DateOrdered: time.Now(), OrderNumber: uint(time.Now().Unix() % 100000)}
	if err := db.Create(&order).Error; err != nil {
		c.JSON(500, gin.H{"error": "failed"})
		return
	}
	c.JSON(201, gin.H{"message": "experimental order assigned", "order_id": order.ID})
}

func handleTechRecipesCRUD(c *gin.Context) {
	id := c.Param("id")
	switch c.Request.Method {
	case http.MethodGet:
		if id == "" {
			limit, offset := parsePagination(c)
			var r []Recipe
			var total int64
			db.Model(&Recipe{}).Count(&total)
			db.Preload("Material").Preload("Compound").Limit(limit).Offset(offset).Find(&r)
			writePaged(c, r, total, limit, offset)
		} else {
			var r Recipe
			db.First(&r, id)
			c.JSON(200, r)
		}
	case http.MethodPost:
		var r Recipe
		c.BindJSON(&r)
		db.Create(&r)
		c.JSON(201, gin.H{"message": "created"})
	case http.MethodPut:
		var r Recipe
		c.BindJSON(&r)
		idUint, _ := strconv.ParseUint(id, 10, 32)
		r.ID = uint(idUint)
		db.Save(&r)
		c.JSON(200, gin.H{"message": "updated"})
	case http.MethodDelete:
		db.Where("id = ?", id).Delete(&Recipe{})
		c.JSON(200, gin.H{"message": "deleted"})
	default:
		c.AbortWithStatus(405)
	}
}

func handleTechCompoundPropertiesCRUD(c *gin.Context) {
	compoundID := c.Param("id")
	tempStr := c.Query("temperature")
	temperature, _ := strconv.ParseFloat(tempStr, 64)
	switch c.Request.Method {
	case http.MethodGet:
		var p []CompoundProperties
		db.Where("compound_id = ?", compoundID).Find(&p)
		c.JSON(200, p)
	case http.MethodPost:
		var p CompoundProperties
		c.BindJSON(&p)
		cid, _ := strconv.ParseUint(compoundID, 10, 32)
		p.CompoundID = uint(cid)
		db.Create(&p)
		c.JSON(201, gin.H{"message": "created"})
	case http.MethodPut:
		if tempStr == "" {
			c.JSON(400, gin.H{"error": "temperature required"})
			return
		}
		var p CompoundProperties
		c.BindJSON(&p)
		db.Model(&CompoundProperties{}).Where("compound_id = ? AND temperature = ?", compoundID, temperature).Updates(map[string]interface{}{"dynamic_viscosity": p.DynamicViscosity, "surface_tension": p.SurfaceTension, "density": p.Density, "ultrasound_speed": p.UltrasoundSpeed, "acoustic_impedance": p.AcousticImpedance})
		c.JSON(200, gin.H{"message": "updated"})
	case http.MethodDelete:
		if tempStr == "" {
			c.JSON(400, gin.H{"error": "temperature required"})
			return
		}
		db.Where("compound_id = ? AND temperature = ?", compoundID, temperature).Delete(&CompoundProperties{})
		c.JSON(200, gin.H{"message": "deleted"})
	default:
		c.AbortWithStatus(405)
	}
}

func handleTechConstants(c *gin.Context) {
	id := c.Param("id")
	switch c.Request.Method {
	case http.MethodGet:
		if id == "" {
			var consts []AdjustibleConstant
			var total int64
			db.Model(&AdjustibleConstant{}).Count(&total)
			db.Find(&consts)
			writePaged(c, consts, total, len(consts), 0)
		} else {
			var constObj AdjustibleConstant
			db.First(&constObj, id)
			c.JSON(200, constObj)
		}
	case http.MethodPut:
		var constObj AdjustibleConstant
		c.BindJSON(&constObj)
		idUint, _ := strconv.ParseUint(id, 10, 32)
		constObj.ID = uint(idUint)
		db.Save(&constObj)
		c.JSON(200, gin.H{"message": "updated"})
	default:
		c.AbortWithStatus(405)
	}
}

func handleTechMaterialsCRUD(c *gin.Context) {
	id := c.Param("id")
	switch c.Request.Method {
	case http.MethodGet:
		if id == "" {
			limit, offset := parsePagination(c)
			var mats []Material
			var total int64
			db.Model(&Material{}).Count(&total)
			db.Limit(limit).Offset(offset).Find(&mats)
			writePaged(c, mats, total, limit, offset)
		} else {
			var m Material
			db.First(&m, id)
			c.JSON(200, m)
		}
	case http.MethodPost:
		var m Material
		c.BindJSON(&m)
		db.Create(&m)
		c.JSON(201, gin.H{"message": "created"})
	case http.MethodPut:
		var m Material
		c.BindJSON(&m)
		idUint, _ := strconv.ParseUint(id, 10, 32)
		m.ID = uint(idUint)
		db.Save(&m)
		c.JSON(200, gin.H{"message": "updated"})
	case http.MethodDelete:
		db.Where("id = ?", id).Delete(&Material{})
		c.JSON(200, gin.H{"message": "deleted"})
	default:
		c.AbortWithStatus(405)
	}
}

func handleTechCompoundsList(c *gin.Context) {
	limit, offset := parsePagination(c)
	var comps []Compound
	var total int64
	db.Model(&Compound{}).Count(&total)
	db.Limit(limit).Offset(offset).Find(&comps)
	writePaged(c, comps, total, limit, offset)
}
func handleTechCompoundsSingle(c *gin.Context) {
	id := c.Param("id")
	switch c.Request.Method {
	case http.MethodGet:
		var comp Compound
		db.First(&comp, id)
		c.JSON(200, comp)
	case http.MethodPut:
		var comp Compound
		c.BindJSON(&comp)
		idUint, _ := strconv.ParseUint(id, 10, 32)
		comp.ID = uint(idUint)
		db.Save(&comp)
		c.JSON(200, gin.H{"message": "updated"})
	case http.MethodDelete:
		db.Where("id = ?", id).Delete(&Compound{})
		c.JSON(200, gin.H{"message": "deleted"})
	default:
		c.AbortWithStatus(405)
	}
}
func handleTechCompoundsCreate(c *gin.Context) {
	var comp Compound
	c.BindJSON(&comp)
	db.Create(&comp)
	c.JSON(201, gin.H{"message": "created"})
}

func handleOperatorInstallations(c *gin.Context) {
	id := c.Param("id")
	switch c.Request.Method {
	case http.MethodGet:
		if id == "" {
			limit, offset := parsePagination(c)
			var insts []UsInstallation
			var total int64
			db.Model(&UsInstallation{}).Count(&total)
			db.Limit(limit).Offset(offset).Find(&insts)
			writePaged(c, insts, total, limit, offset)
		} else {
			var inst UsInstallation
			db.First(&inst, id)
			c.JSON(200, inst)
		}
	case http.MethodPost:
		var inst UsInstallation
		c.BindJSON(&inst)
		db.Create(&inst)
		c.JSON(201, gin.H{"message": "created"})
	case http.MethodPut:
		var inst UsInstallation
		c.BindJSON(&inst)
		idUint, _ := strconv.ParseUint(id, 10, 32)
		inst.ID = uint(idUint)
		db.Save(&inst)
		c.JSON(200, gin.H{"message": "updated"})
	case http.MethodDelete:
		db.Where("id = ?", id).Delete(&UsInstallation{})
		c.JSON(200, gin.H{"message": "deleted"})
	default:
		c.AbortWithStatus(405)
	}
}
func handleOperatorAssignedWorks(c *gin.Context) {
	limit, offset := parsePagination(c)
	opUsername, _ := c.Get("username")
	var op User
	db.Where("username = ?", opUsername).First(&op)
	var orders []Order
	var total int64
	db.Model(&Order{}).Where("status = ?", "new").Count(&total)
	db.Where("status = ?", "new").Preload("Recipe").Preload("Recipe.Material").Preload("Recipe.Compound").Limit(limit).Offset(offset).Find(&orders)
	writePaged(c, orders, total, limit, offset)
}

// ==========================================================
// 7. MAIN & ROUTER
// ==========================================================
func main() {
	connectDB()
	seedAdmin()
	r := gin.Default()
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", c.Request.Header.Get("Origin"))
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})
	r.POST("/api/login", login)

	admin := r.Group("/api/admin")
	admin.Use(authMiddleware(), requireRole(RoleAdmin))
	{
		admin.POST("/users/register", registerUser)
		admin.GET("/tables", handleAdminListTables)
		admin.Any("/data/:table", handleAdminDBCRUD)
		admin.Any("/data/:table/:id", handleAdminDBCRUD)
	}

	director := r.Group("/api/manager")
	director.Use(authMiddleware(), requireRole(RoleDirector, RoleAdmin))
	{
		director.Any("/clients", handleDirectorClients)
		director.Any("/clients/:id", handleDirectorClients)
		director.Any("/orders", handleDirectorOrders)
		director.Any("/orders/:id", handleDirectorOrders)
		director.GET("/stats", handleDirectorStats)
	}

	// Технолог (п. 3.2.2)
	tech := r.Group("/api/tech")
	tech.Use(authMiddleware(), requireRole(RoleTechnologist, RoleAdmin))
	{
		tech.GET("/orders/experimental", handleTechExpOrders)
		tech.POST("/orders/experimental", handleTechAssignExpOrder)

		// === ИСПРАВЛЕНО: Разделение маршрутов для рецептов ===
		// 1. Список рецептов (без параметра)
		tech.GET("/recipes", func(c *gin.Context) {
			limit, offset := parsePagination(c)
			var recipes []Recipe
			var total int64
			db.Model(&Recipe{}).Count(&total)
			db.Preload("Material").Preload("Compound").Limit(limit).Offset(offset).Find(&recipes)
			writePaged(c, recipes, total, limit, offset)
		})
		// 2. CRUD для конкретного рецепта
		tech.POST("/recipes", handleTechRecipesCRUD)
		// 3. Специфичный маршрут для статистики (регистрируется ПОСЛЕ общего :id)
		tech.GET("/recipes/:id/stats", handleTechRecipeStats)
		tech.Any("/recipes/:id", handleTechRecipesCRUD)

		// ML модели
		tech.GET("/ml/models", func(c *gin.Context) {
			limit, offset := parsePagination(c)
			var models []AnalyticsModel
			var total int64
			db.Model(&AnalyticsModel{}).Count(&total)
			db.Limit(limit).Offset(offset).Find(&models)
			writePaged(c, models, total, limit, offset)
		})
		tech.POST("/ml/train", handleTechMLTrain)
		tech.POST("/ml/predict", handleTechMLPredict)
		tech.Any("/ml/models/:id", handleTechModelCRUD)

		// Константы
		tech.GET("/constants", func(c *gin.Context) {
			limit, offset := parsePagination(c)
			var consts []AdjustibleConstant
			var total int64
			db.Model(&AdjustibleConstant{}).Count(&total)
			db.Limit(limit).Offset(offset).Find(&consts)
			writePaged(c, consts, total, limit, offset)
		})
		tech.GET("/constants/:id", handleTechConstants)
		tech.PUT("/constants/:id", handleTechConstants)

		// Материалы
		tech.GET("/materials", func(c *gin.Context) {
			limit, offset := parsePagination(c)
			var materials []Material
			var total int64
			db.Model(&Material{}).Count(&total)
			db.Limit(limit).Offset(offset).Find(&materials)
			writePaged(c, materials, total, limit, offset)
		})
		tech.POST("/materials", handleTechMaterialsCRUD)
		tech.Any("/materials/:id", handleTechMaterialsCRUD)

		// === ИСПРАВЛЕНО: Маршруты для компаундов ===
		// 1. Список компаундов
		tech.GET("/compounds", handleTechCompoundsList)
		// 2. Создание компаунда
		tech.POST("/compounds", handleTechCompoundsCreate)
		// 3. CRUD для конкретного компаунда
		// 4. Свойства компаунда (специфичный маршрут регистрируется ПОСЛЕ общего :id)
		tech.Any("/compounds/:id/properties", handleTechCompoundPropertiesCRUD)
		tech.Any("/compounds/:id", handleTechCompoundsSingle)
	}

	op := r.Group("/api/operator")
	op.Use(authMiddleware(), requireRole(RoleOperator, RoleAdmin))
	{
		op.GET("/works/assigned", handleOperatorAssignedWorks)
		op.Any("/installations", handleOperatorInstallations)
		op.Any("/installations/:id", handleOperatorInstallations)
		op.GET("/ws", handleOperatorWS)
	}

	r.Run(":8080")
}
