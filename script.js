class DeliveryRouteOptimizer {
    constructor() {
        this.canvas = document.getElementById('deliveryMap');
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.edges = [];
        this.restaurant = null;
        this.customers = [];
        this.graph = {};
        this.animationSpeed = 5;
        this.currentAlgorithm = 'both';
        this.isRunning = false;
        this.stepMode = false;
        this.currentStep = 0;
        
        // Algorithm states
        this.dijkstraState = {
            distances: {},
            previous: {},
            visited: new Set(),
            unvisited: new Set(),
            current: null,
            path: [],
            steps: 0,
            totalDistance: 0,
            isComplete: false
        };
        
        this.greedyState = {
            currentRoute: [],
            remainingCustomers: [],
            path: [],
            steps: 0,
            totalDistance: 0,
            isComplete: false
        };
        
        this.init();
        this.setupEventListeners();
        this.generateRandomMap();
        this.updateCodeDisplay();
        this.updateStats();
        this.updateNodeCount();
        this.updateStatus("Ready to Optimize");
    }

    init() {
        // Set canvas size
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        
        // Initialize code display
        this.dijkstraCode = `function dijkstra(graph, start, customers) {
    // Initialize distances and previous nodes
    let distances = {};
    let previous = {};
    let unvisited = new Set(Object.keys(graph));
    
    for (let node in graph) {
        distances[node] = Infinity;
        previous[node] = null;
    }
    distances[start] = 0;
    
    // Main algorithm loop
    while (unvisited.size > 0) {
        // Find unvisited node with minimum distance
        let current = null;
        let minDist = Infinity;
        
        for (let node of unvisited) {
            if (distances[node] < minDist) {
                minDist = distances[node];
                current = node;
            }
        }
        
        if (current === null) break;
        unvisited.delete(current);
        
        // Update distances to neighbors
        for (let neighbor in graph[current]) {
            if (unvisited.has(neighbor)) {
                let alt = distances[current] + graph[current][neighbor];
                if (alt < distances[neighbor]) {
                    distances[neighbor] = alt;
                    previous[neighbor] = current;
                }
            }
        }
    }
    
    // Reconstruct paths to all customers
    return buildPaths(previous, customers);
}`;

        this.greedyCode = `function greedyRoute(start, customers, graph) {
    let route = [start];
    let remaining = [...customers];
    let totalDistance = 0;
    let path = [];
    
    while (remaining.length > 0) {
        let current = route[route.length - 1];
        let nearest = null;
        let minDist = Infinity;
        
        // Find nearest customer (Greedy choice)
        for (let customer of remaining) {
            let dist = calculateDistance(current, customer);
            if (dist < minDist) {
                minDist = dist;
                nearest = customer;
            }
        }
        
        // Add to route and update
        route.push(nearest);
        totalDistance += minDist;
        path.push({from: current, to: nearest});
        remaining = remaining.filter(c => c !== nearest);
    }
    
    return { route, totalDistance, path };
}`;
    }

    setupEventListeners() {
        // Control buttons
        document.getElementById('generateGraph').addEventListener('click', () => this.generateRandomMap());
        document.getElementById('addCustomer').addEventListener('click', () => this.addRandomCustomer());
        document.getElementById('clearAll').addEventListener('click', () => this.clearAll());
        document.getElementById('runAlgorithm').addEventListener('click', () => this.runAlgorithms());
        document.getElementById('stepByStep').addEventListener('click', () => this.toggleStepMode());
        
        // Speed control
        document.getElementById('speedControl').addEventListener('input', (e) => {
            this.animationSpeed = e.target.value;
        });

        // Algorithm selection
        document.querySelectorAll('.algo-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.algo-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentAlgorithm = btn.dataset.algo;
                this.draw();
            });
        });

        // Canvas click for manual node placement
        this.canvas.addEventListener('click', (e) => {
            if (this.isRunning) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (this.nodes.length < 25) {
                const nodeId = `N${this.nodes.length}`;
                const isRestaurant = this.nodes.length === 0;
                
                const node = {
                    id: nodeId,
                    x: x,
                    y: y,
                    type: isRestaurant ? 'restaurant' : 'customer',
                    label: isRestaurant ? 'Restaurant' : `C${this.customers.length + 1}`
                };
                
                this.nodes.push(node);
                
                if (isRestaurant) {
                    this.restaurant = node;
                } else {
                    this.customers.push(node);
                }
                
                this.generateEdges();
                this.draw();
                this.updateNodeCount();
            }
        });
    }

    generateRandomMap() {
        this.resetAlgorithmStates();
        this.nodes = [];
        this.edges = [];
        this.customers = [];
        this.restaurant = null;
        
        // Generate 20-25 random nodes
        const nodeCount = 20 + Math.floor(Math.random() * 6);
        
        for (let i = 0; i < nodeCount; i++) {
            const padding = 80;
            const x = padding + Math.random() * (this.canvas.width - 2 * padding);
            const y = padding + Math.random() * (this.canvas.height - 2 * padding);
            
            const node = {
                id: `N${i}`,
                x: x,
                y: y,
                type: i === 0 ? 'restaurant' : 'customer',
                label: i === 0 ? 'Restaurant' : `C${i}`
            };
            
            this.nodes.push(node);
            
            if (i === 0) {
                this.restaurant = node;
            } else {
                this.customers.push(node);
            }
        }
        
        this.generateEdges();
        this.draw();
        this.updateStats();
        this.updateNodeCount();
        this.updateStatus("New Map Generated!");
        
        // Update progress bars
        document.getElementById('dijkstraProgress').style.width = '0%';
        document.getElementById('greedyProgress').style.width = '0%';
        document.getElementById('dijkstraSteps').textContent = 'Steps: 0';
        document.getElementById('greedySteps').textContent = 'Steps: 0';
    }

    generateEdges() {
        this.edges = [];
        this.graph = {};
        
        // Initialize graph
        for (let node of this.nodes) {
            this.graph[node.id] = {};
        }
        
        // Connect nodes based on proximity
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const nodeA = this.nodes[i];
                const nodeB = this.nodes[j];
                const distance = this.calculateDistance(nodeA, nodeB);
                
                // Connect if within reasonable distance (creates a nice network)
                if (distance < 350 && Math.random() > 0.3) {
                    this.edges.push({
                        from: nodeA,
                        to: nodeB,
                        distance: distance
                    });
                    
                    this.graph[nodeA.id][nodeB.id] = distance;
                    this.graph[nodeB.id][nodeA.id] = distance;
                }
            }
        }
        
        // Ensure all nodes are connected (create minimum spanning tree)
        this.ensureConnectivity();
    }

    ensureConnectivity() {
        const visited = new Set();
        const unvisited = new Set(this.nodes.map(n => n.id));
        
        if (unvisited.size === 0) return;
        
        const queue = [this.nodes[0].id];
        visited.add(this.nodes[0].id);
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            for (let neighbor in this.graph[current]) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }
        
        // Connect any disconnected nodes
        for (let nodeId of unvisited) {
            if (!visited.has(nodeId)) {
                // Find nearest visited node
                let nearest = null;
                let minDist = Infinity;
                const node = this.nodes.find(n => n.id === nodeId);
                
                for (let visitedId of visited) {
                    const visitedNode = this.nodes.find(n => n.id === visitedId);
                    const dist = this.calculateDistance(node, visitedNode);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = visitedNode;
                    }
                }
                
                if (nearest) {
                    this.edges.push({
                        from: node,
                        to: nearest,
                        distance: minDist
                    });
                    
                    this.graph[nodeId][nearest.id] = minDist;
                    this.graph[nearest.id][nodeId] = minDist;
                    visited.add(nodeId);
                }
            }
        }
    }

    addRandomCustomer() {
        if (this.nodes.length >= 25) {
            alert("Maximum 25 nodes allowed!");
            return;
        }
        
        if (!this.restaurant) {
            alert("Please add a restaurant first!");
            return;
        }
        
        const padding = 80;
        const x = padding + Math.random() * (this.canvas.width - 2 * padding);
        const y = padding + Math.random() * (this.canvas.height - 2 * padding);
        
        const nodeId = `N${this.nodes.length}`;
        const node = {
            id: nodeId,
            x: x,
            y: y,
            type: 'customer',
            label: `C${this.customers.length + 1}`
        };
        
        this.nodes.push(node);
        this.customers.push(node);
        this.generateEdges();
        this.draw();
        this.updateNodeCount();
        this.updateStatus(`Customer ${this.customers.length} added`);
    }

    clearAll() {
        this.nodes = [];
        this.edges = [];
        this.restaurant = null;
        this.customers = [];
        this.graph = {};
        this.resetAlgorithmStates();
        this.draw();
        this.updateStats();
        this.updateNodeCount();
        this.updateStatus("Map Cleared");
        
        // Reset progress bars
        document.getElementById('dijkstraProgress').style.width = '0%';
        document.getElementById('greedyProgress').style.width = '0%';
        document.getElementById('dijkstraSteps').textContent = 'Steps: 0';
        document.getElementById('greedySteps').textContent = 'Steps: 0';
    }

    toggleStepMode() {
        if (this.isRunning) {
            this.stepMode = !this.stepMode;
            this.updateStatus(this.stepMode ? "Step Mode: Press Run to continue" : "Running...");
        } else {
            alert("Please run the algorithm first!");
        }
    }

    runAlgorithms() {
        if (this.isRunning) {
            // If already running, just continue
            return;
        }
        
        if (!this.restaurant) {
            alert("Please add a restaurant first!");
            return;
        }
        
        if (this.customers.length === 0) {
            alert("Please add some customers first!");
            return;
        }
        
        this.resetAlgorithmStates();
        this.isRunning = true;
        this.stepMode = false;
        this.updateStatus("Running Algorithms...");
        
        // Initialize algorithms based on selection
        if (this.currentAlgorithm === 'both' || this.currentAlgorithm === 'dijkstra') {
            this.initializeDijkstra();
        }
        
        if (this.currentAlgorithm === 'both' || this.currentAlgorithm === 'greedy') {
            this.initializeGreedy();
        }
        
        // Start animation
        this.animateAlgorithms();
    }

    initializeDijkstra() {
        const nodes = Object.keys(this.graph);
        
        this.dijkstraState.distances = {};
        this.dijkstraState.previous = {};
        this.dijkstraState.visited = new Set();
        this.dijkstraState.unvisited = new Set(nodes);
        this.dijkstraState.current = null;
        this.dijkstraState.path = [];
        this.dijkstraState.steps = 0;
        this.dijkstraState.totalDistance = 0;
        this.dijkstraState.isComplete = false;
        
        for (let node of nodes) {
            this.dijkstraState.distances[node] = Infinity;
            this.dijkstraState.previous[node] = null;
        }
        this.dijkstraState.distances[this.restaurant.id] = 0;
    }

    initializeGreedy() {
        this.greedyState.currentRoute = [this.restaurant];
        this.greedyState.remainingCustomers = [...this.customers];
        this.greedyState.path = [];
        this.greedyState.steps = 0;
        this.greedyState.totalDistance = 0;
        this.greedyState.isComplete = false;
    }

    animateAlgorithms() {
        if (!this.isRunning) return;
        
        let dijkstraDone = true;
        let greedyDone = true;
        
        // Execute one step of each algorithm
        if (this.currentAlgorithm === 'both' || this.currentAlgorithm === 'dijkstra') {
            if (!this.dijkstraState.isComplete) {
                dijkstraDone = this.dijkstraStep();
                if (dijkstraDone) {
                    this.dijkstraState.isComplete = true;
                    this.buildDijkstraPaths();
                }
            }
        }
        
        if (this.currentAlgorithm === 'both' || this.currentAlgorithm === 'greedy') {
            if (!this.greedyState.isComplete) {
                greedyDone = this.greedyStep();
                if (greedyDone) {
                    this.greedyState.isComplete = true;
                }
            }
        }
        
        // Update visualization
        this.draw();
        this.updateProgress();
        this.updateStats();
        this.updateCodeDisplay();
        
        // Check if all algorithms are complete
        const allDone = (this.currentAlgorithm === 'both' && dijkstraDone && greedyDone) ||
                       (this.currentAlgorithm === 'dijkstra' && dijkstraDone) ||
                       (this.currentAlgorithm === 'greedy' && greedyDone);
        
        // Continue animation or stop
        if (!allDone) {
            if (this.stepMode) {
                this.updateStatus("Step Mode: Press Run to continue");
                this.isRunning = false;
            } else {
                const speed = 500 - (this.animationSpeed * 45);
                setTimeout(() => this.animateAlgorithms(), speed);
            }
        } else {
            this.isRunning = false;
            this.updateStatus("Algorithms Complete!");
            this.highlightOptimalPath();
            this.showComparisonResults();
        }
    }

    dijkstraStep() {
        if (this.dijkstraState.unvisited.size === 0) {
            return true;
        }
        
        // Find unvisited node with smallest distance
        let current = null;
        let minDistance = Infinity;
        
        for (let node of this.dijkstraState.unvisited) {
            if (this.dijkstraState.distances[node] < minDistance) {
                minDistance = this.dijkstraState.distances[node];
                current = node;
            }
        }
        
        if (current === null || minDistance === Infinity) {
            return true;
        }
        
        this.dijkstraState.current = current;
        this.dijkstraState.unvisited.delete(current);
        this.dijkstraState.visited.add(current);
        this.dijkstraState.steps++;
        
        // Update neighbors' distances
        for (let neighbor in this.graph[current]) {
            if (this.dijkstraState.unvisited.has(neighbor)) {
                const alt = this.dijkstraState.distances[current] + this.graph[current][neighbor];
                
                if (alt < this.dijkstraState.distances[neighbor]) {
                    this.dijkstraState.distances[neighbor] = alt;
                    this.dijkstraState.previous[neighbor] = current;
                }
            }
        }
        
        return false;
    }

    greedyStep() {
        if (this.greedyState.remainingCustomers.length === 0) {
            return true;
        }
        
        const current = this.greedyState.currentRoute[this.greedyState.currentRoute.length - 1];
        
        // Find nearest remaining customer
        let nearest = null;
        let minDist = Infinity;
        
        for (let customer of this.greedyState.remainingCustomers) {
            const dist = this.calculateDistance(current, customer);
            if (dist < minDist) {
                minDist = dist;
                nearest = customer;
            }
        }
        
        if (nearest) {
            this.greedyState.currentRoute.push(nearest);
            this.greedyState.remainingCustomers = this.greedyState.remainingCustomers.filter(c => c.id !== nearest.id);
            this.greedyState.totalDistance += minDist;
            this.greedyState.path.push({ from: current, to: nearest, distance: minDist });
            this.greedyState.steps++;
        }
        
        return this.greedyState.remainingCustomers.length === 0;
    }

    buildDijkstraPaths() {
        // Build optimal paths to all customers
        this.dijkstraState.path = [];
        this.dijkstraState.totalDistance = 0;
        
        for (let customer of this.customers) {
            let pathSegment = [];
            let current = customer.id;
            
            while (current !== null && current !== this.restaurant.id) {
                const prev = this.dijkstraState.previous[current];
                if (prev !== null) {
                    const fromNode = this.nodes.find(n => n.id === prev);
                    const toNode = this.nodes.find(n => n.id === current);
                    
                    if (fromNode && toNode) {
                        const edgeDistance = this.calculateDistance(fromNode, toNode);
                        pathSegment.unshift({ from: fromNode, to: toNode, distance: edgeDistance });
                        this.dijkstraState.totalDistance += edgeDistance;
                    }
                }
                current = prev;
            }
            
            this.dijkstraState.path.push(...pathSegment);
        }
    }

    calculateDistance(nodeA, nodeB) {
        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background grid
        this.drawGrid();
        
        // Draw edges (roads)
        this.drawEdges();
        
        // Draw algorithm-specific paths
        this.drawAlgorithmPaths();
        
        // Draw nodes
        this.drawNodes();
        
        // Draw labels
        this.drawLabels();
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x <= this.canvas.width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= this.canvas.height; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawEdges() {
        this.ctx.strokeStyle = '#bdc3c7';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([]);
        
        for (let edge of this.edges) {
            this.ctx.beginPath();
            this.ctx.moveTo(edge.from.x, edge.from.y);
            this.ctx.lineTo(edge.to.x, edge.to.y);
            this.ctx.stroke();
        }
    }

    drawAlgorithmPaths() {
        // Draw Dijkstra's path
        if (this.dijkstraState.path.length > 0 && (this.currentAlgorithm === 'both' || this.currentAlgorithm === 'dijkstra')) {
            this.ctx.strokeStyle = '#9b59b6';
            this.ctx.lineWidth = 4;
            this.ctx.setLineDash([]);
            
            for (let segment of this.dijkstraState.path) {
                this.ctx.beginPath();
                this.ctx.moveTo(segment.from.x, segment.from.y);
                this.ctx.lineTo(segment.to.x, segment.to.y);
                this.ctx.stroke();
            }
            
            // Draw visited nodes highlight
            for (let nodeId of this.dijkstraState.visited) {
                const node = this.nodes.find(n => n.id === nodeId);
                if (node) {
                    this.ctx.fillStyle = 'rgba(155, 89, 182, 0.2)';
                    this.ctx.beginPath();
                    this.ctx.arc(node.x, node.y, 25, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
            
            // Draw current node
            if (this.dijkstraState.current) {
                const current = this.nodes.find(n => n.id === this.dijkstraState.current);
                if (current) {
                    this.ctx.fillStyle = '#f1c40f';
                    this.ctx.beginPath();
                    this.ctx.arc(current.x, current.y, 12, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    this.ctx.strokeStyle = '#f39c12';
                    this.ctx.lineWidth = 3;
                    this.ctx.beginPath();
                    this.ctx.arc(current.x, current.y, 15, 0, Math.PI * 2);
                    this.ctx.stroke();
                }
            }
        }
        
        // Draw Greedy path
        if (this.greedyState.path.length > 0 && (this.currentAlgorithm === 'both' || this.currentAlgorithm === 'greedy')) {
            this.ctx.strokeStyle = '#1abc9c';
            this.ctx.lineWidth = 4;
            this.ctx.setLineDash([5, 5]);
            
            for (let segment of this.greedyState.path) {
                this.ctx.beginPath();
                this.ctx.moveTo(segment.from.x, segment.from.y);
                this.ctx.lineTo(segment.to.x, segment.to.y);
                this.ctx.stroke();
            }
            
            // Draw current route
            if (this.greedyState.currentRoute.length > 1) {
                this.ctx.strokeStyle = '#1abc9c';
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([]);
                this.ctx.beginPath();
                
                for (let i = 0; i < this.greedyState.currentRoute.length; i++) {
                    if (i === 0) {
                        this.ctx.moveTo(this.greedyState.currentRoute[i].x, this.greedyState.currentRoute[i].y);
                    } else {
                        this.ctx.lineTo(this.greedyState.currentRoute[i].x, this.greedyState.currentRoute[i].y);
                    }
                }
                this.ctx.stroke();
            }
        }
    }

    drawNodes() {
        // Draw all nodes
        for (let node of this.nodes) {
            // Draw node
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, 15, 0, Math.PI * 2);
            
            // Set colors based on node type
            if (node.type === 'restaurant') {
                this.ctx.fillStyle = '#e74c3c';
                this.ctx.shadowColor = '#c0392b';
            } else {
                this.ctx.fillStyle = '#3498db';
                this.ctx.shadowColor = '#2980b9';
            }
            
            // Add shadow for 3D effect
            this.ctx.shadowBlur = 10;
            this.ctx.shadowOffsetX = 2;
            this.ctx.shadowOffsetY = 2;
            
            this.ctx.fill();
            
            // Reset shadow
            this.ctx.shadowBlur = 0;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;
            
            // Draw border
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            // Draw node number/letter
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            if (node.type === 'restaurant') {
                this.ctx.fillText('R', node.x, node.y);
            } else {
                const customerNum = parseInt(node.label.substring(1));
                this.ctx.fillText(customerNum.toString(), node.x, node.y);
            }
        }
    }

    drawLabels() {
        // Draw distance labels on edges
        this.ctx.fillStyle = '#7f8c8d';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        
        for (let edge of this.edges) {
            const midX = (edge.from.x + edge.to.x) / 2;
            const midY = (edge.from.y + edge.to.y) / 2;
            
            // Draw background for better readability
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            this.ctx.fillRect(midX - 20, midY - 8, 40, 16);
            
            // Draw distance
            this.ctx.fillStyle = '#2c3e50';
            this.ctx.fillText(Math.round(edge.distance) + 'm', midX, midY + 3);
        }
    }

    updateProgress() {
        // Update Dijkstra progress
        const dijkstraProgress = this.dijkstraState.visited.size / this.nodes.length * 100;
        document.getElementById('dijkstraProgress').style.width = dijkstraProgress + '%';
        document.getElementById('dijkstraSteps').textContent = `Steps: ${this.dijkstraState.steps}`;
        
        // Update Greedy progress
        const greedyProgress = (this.customers.length - this.greedyState.remainingCustomers.length) / this.customers.length * 100;
        document.getElementById('greedyProgress').style.width = greedyProgress + '%';
        document.getElementById('greedySteps').textContent = `Steps: ${this.greedyState.steps}`;
    }

    updateStats() {
        // Update Dijkstra stats
        document.getElementById('dijkstra-distance').textContent = 
            this.dijkstraState.isComplete ? `${Math.round(this.dijkstraState.totalDistance)}m` : 'Calculating...';
        document.getElementById('dijkstra-time').textContent = 
            this.dijkstraState.steps > 0 ? `${this.dijkstraState.steps * 50}ms` : '0ms';
        document.getElementById('dijkstra-nodes').textContent = this.dijkstraState.visited.size;
        
        // Update Greedy stats
        document.getElementById('greedy-distance').textContent = 
            this.greedyState.isComplete ? `${Math.round(this.greedyState.totalDistance)}m` : 'Calculating...';
        document.getElementById('greedy-time').textContent = 
            this.greedyState.steps > 0 ? `${this.greedyState.steps * 30}ms` : '0ms';
        document.getElementById('greedy-nodes').textContent = this.greedyState.steps;
        
        // Calculate efficiencies if both are complete
        if (this.dijkstraState.isComplete && this.greedyState.isComplete && this.dijkstraState.totalDistance > 0) {
            const dijkstraEfficiency = 100;
            const greedyEfficiency = Math.round((this.dijkstraState.totalDistance / this.greedyState.totalDistance) * 100);
            
            document.getElementById('dijkstra-efficiency').textContent = `${dijkstraEfficiency}%`;
            document.getElementById('greedy-efficiency').textContent = `${greedyEfficiency}%`;
        } else {
            document.getElementById('dijkstra-efficiency').textContent = '0%';
            document.getElementById('greedy-efficiency').textContent = '0%';
        }
    }

    updateNodeCount() {
        document.getElementById('nodeCount').textContent = `${this.nodes.length} Nodes (${this.customers.length} Customers)`;
    }

    updateStatus(message) {
        document.getElementById('statusText').textContent = message;
        
        // Update status indicator color
        const statusIndicator = document.querySelector('.status-indicator i');
        if (message.includes('Complete')) {
            statusIndicator.style.color = '#2ecc71';
        } else if (message.includes('Running')) {
            statusIndicator.style.color = '#f39c12';
        } else if (message.includes('Error')) {
            statusIndicator.style.color = '#e74c3c';
        } else {
            statusIndicator.style.color = '#3498db';
        }
    }

    updateCodeDisplay() {
        document.getElementById('dijkstraCode').textContent = this.dijkstraCode;
        document.getElementById('greedyCode').textContent = this.greedyCode;
        
        // Highlight current line based on algorithm state
        const dijkstraStatus = document.querySelector('.dijkstra-code .code-status');
        const greedyStatus = document.querySelector('.greedy-code .code-status');
        
        if (this.isRunning) {
            if (this.dijkstraState.isComplete) {
                dijkstraStatus.textContent = 'Complete';
                dijkstraStatus.style.background = '#2ecc71';
            } else if (this.currentAlgorithm === 'both' || this.currentAlgorithm === 'dijkstra') {
                dijkstraStatus.textContent = 'Running';
                dijkstraStatus.style.background = '#f39c12';
            } else {
                dijkstraStatus.textContent = 'Paused';
                dijkstraStatus.style.background = '#95a5a6';
            }
            
            if (this.greedyState.isComplete) {
                greedyStatus.textContent = 'Complete';
                greedyStatus.style.background = '#2ecc71';
            } else if (this.currentAlgorithm === 'both' || this.currentAlgorithm === 'greedy') {
                greedyStatus.textContent = 'Running';
                greedyStatus.style.background = '#f39c12';
            } else {
                greedyStatus.textContent = 'Paused';
                greedyStatus.style.background = '#95a5a6';
            }
        } else {
            dijkstraStatus.textContent = 'Ready';
            dijkstraStatus.style.background = '#3498db';
            greedyStatus.textContent = 'Ready';
            greedyStatus.style.background = '#3498db';
        }
    }

    resetAlgorithmStates() {
        this.dijkstraState = {
            distances: {},
            previous: {},
            visited: new Set(),
            unvisited: new Set(),
            current: null,
            path: [],
            steps: 0,
            totalDistance: 0,
            isComplete: false
        };
        
        this.greedyState = {
            currentRoute: [],
            remainingCustomers: [],
            path: [],
            steps: 0,
            totalDistance: 0,
            isComplete: false
        };
        
        this.isRunning = false;
        this.stepMode = false;
    }

    highlightOptimalPath() {
        if (this.dijkstraState.isComplete && this.greedyState.isComplete) {
            let winner = 'Dijkstra';
            let winnerColor = '#9b59b6';
            
            if (this.greedyState.totalDistance < this.dijkstraState.totalDistance) {
                winner = 'Greedy';
                winnerColor = '#1abc9c';
            }
            
            // Flash the winning path
            this.flashPath(winnerColor);
            
            // Show alert with comparison
            setTimeout(() => {
                alert(`🎉 Algorithm Comparison Complete!\n\n` +
                      `Dijkstra's Algorithm:\n` +
                      `- Total Distance: ${Math.round(this.dijkstraState.totalDistance)}m\n` +
                      `- Steps: ${this.dijkstraState.steps}\n\n` +
                      `Greedy Algorithm:\n` +
                      `- Total Distance: ${Math.round(this.greedyState.totalDistance)}m\n` +
                      `- Steps: ${this.greedyState.steps}\n\n` +
                      `🏆 Winner: ${winner} Algorithm\n` +
                      `📊 Efficiency: ${Math.round((Math.min(this.dijkstraState.totalDistance, this.greedyState.totalDistance) / 
                                                   Math.max(this.dijkstraState.totalDistance, this.greedyState.totalDistance)) * 100)}%`);
            }, 1000);
        }
    }

    flashPath(color) {
        let flashCount = 0;
        const flashInterval = setInterval(() => {
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 6;
            this.ctx.setLineDash([]);
            
            // Draw the winning path
            const path = color === '#9b59b6' ? this.dijkstraState.path : this.greedyState.path;
            
            for (let segment of path) {
                this.ctx.beginPath();
                this.ctx.moveTo(segment.from.x, segment.from.y);
                this.ctx.lineTo(segment.to.x, segment.to.y);
                this.ctx.stroke();
            }
            
            flashCount++;
            if (flashCount >= 6) {
                clearInterval(flashInterval);
                this.draw(); // Redraw normal state
            }
            
            // Toggle visibility for flashing effect
            setTimeout(() => {
                this.draw();
            }, 200);
        }, 400);
    }

    showComparisonResults() {
        // This function can be extended to show more detailed results
        console.log('Algorithms comparison complete!');
    }
}

// Initialize the application when the page loads
window.addEventListener('load', () => {
    const optimizer = new DeliveryRouteOptimizer();
    window.deliveryOptimizer = optimizer; // Make it accessible from console
});