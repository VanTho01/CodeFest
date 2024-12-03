// Import socket.io-client
import { io } from "socket.io-client";

// Kết nối đến server
const socket = io.connect('http://localhost:80', { reconnect: true, transports: ['websocket'] });
socket.on("connect", () => {
  console.log("Connected to server:", socket.id);							
});	

const gameId = "ec666c97-daf5-4c5f-9fea-4d4a86204191";
const playerId1_join = "player1-xxx"; //c6352339-7743-484b-b76f-51eaa326a6ef


const currentPosition = [];
//let direction = [];
const oppPosition = []
const isMarrying = false
const playerId1 = playerId1_join.substring(0, 13);
let numberWeaponHammer = 0

// API-1a: Người chơi tham gia trò chơi
socket.emit('join game', { game_id: gameId, player_id: playerId1_join });

// API-1b: Lắng nghe phản hồi khi người chơi tham gia trò chơi
socket.on('join game', (res) => {
  console.log('[Socket] join-game response', res);  
});

// API-4: Đăng ký sức mạnh nhân vật
socket.emit('register character power', { "gameId": gameId, "type": 1 });

// Lắng nghe sự kiện ticktack từ server và xử lý ngay lập tức
socket.on('ticktack player', (res) => {
  console.log("player 1: ", playerId1)
  const players = res.map_info.players
  const gameRemainTime = res.gameRemainTime;
  if (gameRemainTime <= 300000)
  {
    if (players.length !== 0)
    {
      const index_player = find_index_player(players)
      const index_opp = find_index_opp(players)

      currentPosition[0] = players[index_player]['currentPosition']['row'];
      currentPosition[1] = players[index_player]['currentPosition']['col'];
      

      const blockedPositions = []
      try
      {
        oppPosition[0] = players[index_opp]['currentPosition']['row'];
        oppPosition[1] = players[index_opp]['currentPosition']['col'];
        //blockedPositions.push(oppPosition)
      } catch {
        return null;
      }
      
      const isTransformed = players[index_player]['hasTransform']
      const map = res.map_info.map;
      const tag = res.tag;
      console.log("tag: ", tag)
      const bombsPos = []
      const bombsTimeremain = []
    
      const bombs = res.map_info.bombs
      const spoils = res.map_info.spoils
      const spoilsPos = []
      if (spoils.length !== 0)
      {
        if (map[spoils[0].row][spoils[0].col] !== 7)
        {
          spoilsPos.push([spoils[0].row, spoils[0].col])
        }
      }
      const currentWeapon = players[index_player]['currentWeapon'];

      const nineTuskElephant_player = players[index_player]['nineTuskElephant']
      const eternalBadge_player = players[index_player]['eternalBadge']
      const nineTuskElephant_opp = players[index_opp]['nineTuskElephant']
      const eternalBadge_opp = players[index_opp]['eternalBadge']
      
      const holySpiritStone = players[index_player]['holySpiritStone']
      
      const bomb_range_of_player = 1 + nineTuskElephant_player*2  + eternalBadge_player*3
      const bomb_range_of_opp = 1 + nineTuskElephant_opp*2  + eternalBadge_opp*3

      const countBox = map.reduce((total, row) => {
          return total + row.filter(cell => cell === 2).length;
      }, 0);    
    console.log("Số lượng số 3:", countBox);
      console.log("range player, range opp: ", bomb_range_of_player, bomb_range_of_opp)
      bombs.forEach(bomb => {
        console.log("bomb id: ", bomb.playerId)
        if (bomb.playerId === playerId1) 
        {
          bombsPos.push([bomb.row, bomb.col]);
        } else {
          if (manhattanDistance(currentPosition, [bomb.row, bomb.col]) <= bomb_range_of_opp) 
            {
              bombsPos.push([bomb.row, bomb.col]);
            }
        }
        bombsTimeremain.push(bomb.remainTime);
        });
        console.log("bomb pos: ", bombsPos)
        const availPos = [];
        let goal;
        try {
        if (map[currentPosition[0]][currentPosition[1]] !== 5)
        {  
          if (isTransformed === false)
          {
            availPos.push(0, 3, 6, 7);

            goal = 6
            const shortestPath = findShortestPathFromStart(goal, map, currentPosition, blockedPositions, availPos)
            const direction = calculate_direction(map, currentPosition, currentWeapon, shortestPath, oppPosition)
            console.log("direction: ", direction)
            direction.forEach(element => {
              if (element === 'a') {
                socket.emit('action', { "action": "switch weapon" });
              } else {
                socket.emit('drive player', { "direction": element });
              }
            });					
          } else {
            console.log("distance: ", manhattanDistance(currentPosition, oppPosition))
            if (manhattanDistance(currentPosition, oppPosition) >= 5 && manhattanDistance(currentPosition, oppPosition) <= 7)
            {
              try 
                {
                  socket.emit('action', {							
                    "action": "switch weapon"				
                  })
                  socket.emit('action', {						
                    "action": "use weapon",					
                    "payload": {					
                      "destination": {				
                        "col": oppPosition[1],			
                        "row": oppPosition[0]			
                      }				
                    }					
                  })
                } catch {
                  return null
                }
            } 
              if (countBox > 0)
              {
                availPos.push(0, 2, 3, 7);
                goal = 2
                switch (bombs.length) {
                  case 0:
                    const shortestPath = findSpoilOnpath(goal, map, currentPosition, blockedPositions, availPos, spoilsPos)
                    const direction = calculate_direction(map, currentPosition, currentWeapon, shortestPath, oppPosition)
                    console.log("direction: ", direction)
                    direction.forEach(element => {
                      if (element === 'a') {
                        socket.emit('action', { "action": "switch weapon" });
                      } else {
                        socket.emit('drive player', { "direction": element });
                      }
                    });
                    
                  default:
                    if (bombsPos.length != 0)
                    {
                      // const safePath = findSafePathWithNBombs(map, bombsPos, currentPosition, Math.max(...bombsTimeremain), bomb_range_of_player)
                      const safePath = findSafePathAvoidingOpponent(map, bombsPos, currentPosition, Math.max(...bombsTimeremain), bomb_range_of_player, oppPosition)
                      const getdirectionsFromPath = getDirectionsFromPath(map, safePath, currentWeapon, oppPosition);
                      console.log("avoid bomb: ", getdirectionsFromPath)
                      getdirectionsFromPath.forEach(direction => {
                        if (direction === 'a') {
                          socket.emit('action', { "action": "switch weapon" });
                        } else {
                          socket.emit('drive player', { "direction": direction });
                        }
                      });
                      break
                    } else {
                      availPos.push(0, 2, 3, 7);

                      const shortestPath = findSpoilOnpath(goal, map, currentPosition, blockedPositions, availPos, spoilsPos)
                      const direction = calculate_direction(map, currentPosition, currentWeapon, shortestPath, oppPosition)
                      
                      direction.forEach(element => {
                        if (element === 'a') {
                          socket.emit('action', { "action": "switch weapon" });
                        } else {
                          socket.emit('drive player', { "direction": element });
                        }
                      });
                    }
                  }
              } else {
                availPos.push(0, 3, 7);

                const shortestPath = findOpponent(oppPosition, map, currentPosition, blockedPositions, availPos)
                const direction = calculate_direction(map, currentPosition, currentWeapon, shortestPath, oppPosition)
                
                direction.forEach(element => {
                  if (element === 'a') {
                    socket.emit('action', { "action": "switch weapon" });
                  } else {
                    socket.emit('drive player', { "direction": element });
                  }
                });
              }
            }
          }
        }
     catch {
        return null
      }
    }     
}});
function getDirectionsFromPath(map, path, currentWeapon, oppPosition) {
  const directions = [];
  if (path !== null)
  {
    for (let i = 0; i < path.length - 1; i++) {
      const [currentRow, currentCol] = path[i];
      const [nextRow, nextCol] = path[i + 1];

      if (map[nextRow, nextCol] === 3)
      {
          if (currentWeapon === 2)
          {
              directions.push('a')
              directions.push("b")
          } else {
              directions.push("b")
          }
      } 
      else if (map[nextRow][nextCol] === 2 ){
          if (currentWeapon === 1)
          {
            directions.push('a')
            directions.push("b")
          } else {
            directions.push("b")
          }
        if (nextRow === oppPosition[0] && nextCol === oppPosition)
        {
            if (currentWeapon === 2)
            {
                directions.push("b")
            } 
            else if (currentWeapon === 1)
            {
              directions.push('a')
              directions.push("b")
            }
        } 
      }
        if (nextRow < currentRow) {
          directions.push(3); // Đi lên
      } else if (nextRow > currentRow) {
          directions.push(4); // Đi xuống
      } else if (nextCol < currentCol) {
          directions.push(1); // Đi trái
      } else if (nextCol > currentCol) {
          directions.push(2); // Đi phải
      } 
          
     if (map[nextRow][nextCol] === 6){
          directions.push("x")
      }
    }
  }

  return directions;
}
function findShortestPathFromStart(goal, grid, start, blockedPositions, availPos) {
  const rows = grid.length;
  const cols = grid[0].length;
  const directions = [
      [-1, 0], // Lên
      [1, 0],  // Xuống
      [0, -1], // Trái
      [0, 1]   // Phải
  ];

  // Kiểm tra điểm bắt đầu hợp lệ
  const [startX, startY] = start;
  if (![0, 2, 3, 5, 6].includes(grid[startX][startY])) {
      return "Điểm bắt đầu không hợp lệ";
  }

  // Chuyển đổi `blockedPositions` thành tập hợp để tra cứu nhanh
  const blockedSet = new Set(blockedPositions.map(([x, y]) => `${x},${y}`));

  // BFS
  const queue = [[start, [start]]]; // [[vị trí hiện tại], [đường đi]]
  const visited = new Set();
  visited.add(`${startX},${startY}`);

  while (queue.length > 0) {
      const [[x, y], path] = queue.shift();

      // Nếu tìm thấy mục tiêu
      if (grid[x][y] === goal) {
          return path;
      }

      // Duyệt qua các ô lân cận
      for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;

          // Kiểm tra ô hợp lệ, chưa được thăm, không bị chặn, và có thể đi qua
          if (
              nx >= 0 && nx < rows && ny >= 0 && ny < cols &&
              !visited.has(`${nx},${ny}`) &&
              !blockedSet.has(`${nx},${ny}`) &&
              availPos.includes(grid[nx][ny])
          ) {
              queue.push([[nx, ny], [...path, [nx, ny]]]);
              visited.add(`${nx},${ny}`);
          }
      }
  }

  return "Không tìm được đường đi đến mục tiêu";
}
function findSpoilOnpath(goal, grid, start, blockedPositions, availPos, items) {
  const rows = grid.length;
  const cols = grid[0].length;
  const directions = [
      [-1, 0], // Lên
      [1, 0],  // Xuống
      [0, -1], // Trái
      [0, 1]   // Phải
  ];

  // Kiểm tra điểm bắt đầu hợp lệ
  const [startX, startY] = start;
  if (![...availPos, goal].includes(grid[startX][startY])) {
      return null;
  }

  // Chuyển đổi `blockedPositions` thành tập hợp để tra cứu nhanh
  const blockedSet = new Set(blockedPositions.map(([x, y]) => `${x},${y}`));

  // Chuyển đổi `items` thành tập hợp để dễ kiểm tra
  const itemSet = new Set(items.map(([x, y]) => `${x},${y}`));

  // BFS
  const queue = [[start, new Set(), [start]]]; // [[vị trí hiện tại], collectedItems, đường đi]
  const visited = new Map(); // Để lưu trạng thái {vị trí, vật phẩm đã thu thập}

  while (queue.length > 0) {
      const [[x, y], collectedItems, path] = queue.shift();

      // Nếu đã đến mục tiêu và thu thập tất cả vật phẩm
      if (grid[x][y] === goal && collectedItems.size === itemSet.size) {
          return path;
      }

      // Tạo khóa trạng thái
      const stateKey = `${x},${y},${[...collectedItems].sort().join(";")}`;
      if (visited.has(stateKey)) continue;
      visited.set(stateKey, true);

      // Duyệt các ô lân cận
      for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;

          // Kiểm tra ô hợp lệ
          if (
              nx >= 0 && nx < rows && ny >= 0 && ny < cols &&
              !blockedSet.has(`${nx},${ny}`) &&
              availPos.includes(grid[nx][ny])
          ) {
              const newCollectedItems = new Set(collectedItems);

              // Nếu ô này có vật phẩm, thu thập nó
              if (itemSet.has(`${nx},${ny}`)) {
                  newCollectedItems.add(`${nx},${ny}`);
              }

              queue.push([[nx, ny], newCollectedItems, [...path, [nx, ny]]]);
          }
      }
  }

  return null;
}
function findOpponent(goal, grid, start, blockedPositions, availPos) {
  const rows = grid.length;
  const cols = grid[0].length;
  const directions = [
      [-1, 0], // Lên
      [1, 0],  // Xuống
      [0, -1], // Trái
      [0, 1]   // Phải
  ];

  // Kiểm tra điểm bắt đầu hợp lệ
  const [startX, startY] = start;
  if (![0, 2, 3, 5, 6].includes(grid[startX][startY])) {
      return null;
  }

  // Chuyển đổi `blockedPositions` thành tập hợp để tra cứu nhanh
  const blockedSet = new Set(blockedPositions.map(([x, y]) => `${x},${y}`));

  // Tách tọa độ mục tiêu
  const [goalX, goalY] = goal;

  // Kiểm tra mục tiêu hợp lệ
  console.log("goal: ", grid[goalX][goalY])
  if (!availPos.includes(grid[goalX][goalY])) {
      return null;
  }

  // BFS
  const queue = [[start, [start]]]; // [[vị trí hiện tại], [đường đi]]
  const visited = new Set();
  visited.add(`${startX},${startY}`);

  while (queue.length > 0) {
      const [[x, y], path] = queue.shift();

      // Nếu tìm thấy mục tiêu
      if (x === goalX && y === goalY) {
          return path;
      }

      // Duyệt qua các ô lân cận
      for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;

          // Kiểm tra ô hợp lệ, chưa được thăm, không bị chặn, và có thể đi qua
          if (
              nx >= 0 && nx < rows && ny >= 0 && ny < cols &&
              !visited.has(`${nx},${ny}`) &&
              !blockedSet.has(`${nx},${ny}`) &&
              availPos.includes(grid[nx][ny])
          ) {
              queue.push([[nx, ny], [...path, [nx, ny]]]);
              visited.add(`${nx},${ny}`);
          }
      }
  }

  return null;
}
function calculate_direction(grid, startPosition, currentWeapon, shortestPath, oppPosition) {

   let direction = [];
   console.log("shortestpath: ", shortestPath)
    for (const [x, y] of shortestPath) {
        if (startPosition != [x, y])
        {
          if (grid[x][y] === 3 || (x === oppPosition[0] && y === oppPosition[1])){
                
            if (currentWeapon === 2)
            {
              direction.push('a')
              direction.push("b")
            } else {
              direction.push("b")
            }
              
        }
        else if (grid[x][y] === 2 || (x === oppPosition[0] && y === oppPosition[1])){
            if (currentWeapon === 1)
            {
              direction.push('a')
              direction.push("b")
            } else {
              direction.push("b")
            }  
        }
        
            if (startPosition[0]-x === -1 && startPosition[1]-y===0) {
                direction.push(4)
            } else if (startPosition[0]-x === 1 && startPosition[1] - y === 0) {
                direction.push(3)
            } else if (startPosition[1]-y === -1 && startPosition[0] - x === 0) {
                direction.push(2)
            } else if (startPosition[1]-y === 1 && startPosition[0] - x === 0) {
                direction.push(1)
            }
            if (grid[x][y] === 6){
              direction.push("x")
          }
            startPosition[0] = x;
            startPosition[1] = y;
        }
    }
    return direction;
}
function findSafePathWithNBombs(grid, bombPositions, start, timeLimit, range) {
    const rows = grid.length;
    const cols = grid[0].length;
    const directions = [
        [-1, 0], // Lên
        [1, 0],  // Xuống
        [0, -1], // Trái
        [0, 1],  // Phải
    ];

    // Tạo bản đồ phạm vi bom
    const bombRange = Array.from({ length: rows }, () => Array(cols).fill(false));
    for (const [bx, by] of bombPositions) {
        for (let i = -range; i <= range; i++) {
            if (bx + i >= 0 && bx + i < rows) bombRange[bx + i][by] = true;
            if (by + i >= 0 && by + i < cols) bombRange[bx][by + i] = true;
        }
    }

    // BFS tìm ô an toàn trong thời gian giới hạn
    const queue = [[...start, 0, []]]; // Hàng đợi lưu [hàng, cột, thời gian, đường đi]
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));

    visited[start[0]][start[1]] = true;

    while (queue.length > 0) {
        const [x, y, time, path] = queue.shift();

        //Nếu quá thời gian, bỏ qua
        if (time > timeLimit) continue;

        // Kiểm tra nếu đây là ô an toàn
        if (!bombRange[x][y] && [0].includes(grid[x][y])) {
            return path.concat([[x, y]]); // Trả về đường đi đến ô an toàn
        }

        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;

            if (
                nx >= 0 && nx < rows && ny >= 0 && ny < cols && // Trong lưới
                !visited[nx][ny] &&                             // Chưa thăm
                grid[nx][ny] !== 1 && grid[nx][ny] !== 5 && grid[nx][ny] !== 3 && grid[nx][ny] !== 2 
                     // Không phải ô chặn
            ) {
                visited[nx][ny] = true;
                queue.push([nx, ny, time + 1, path.concat([[x, y]])]);
            }
        }
    }

    return null; // Không tìm thấy ô an toàn trong thời gian giới hạn
}

function findSafePathAvoidingOpponent(grid, bombPositions, start, timeLimit, range, opponentPosition) {
  const rows = grid.length;
  const cols = grid[0].length;
  const directions = [
      [-1, 0], // Lên
      [1, 0],  // Xuống
      [0, -1], // Trái
      [0, 1],  // Phải
  ];

  // Tạo bản đồ phạm vi bom
  const bombRange = Array.from({ length: rows }, () => Array(cols).fill(false));
    for (const [bx, by] of bombPositions) {
        for (let i = -range; i <= range; i++) {
            if (bx + i >= 0 && bx + i < rows) bombRange[bx + i][by] = true;
            if (by + i >= 0 && by + i < cols) bombRange[bx][by + i] = true;
        }
    }

  // BFS tìm ô an toàn tránh đối thủ
  const queue = [[...start, 0, []]]; // [hàng, cột, thời gian, đường đi]
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));

  visited[start[0]][start[1]] = true;

  while (queue.length > 0) {
      const [x, y, time, path] = queue.shift();

      // Nếu vượt quá thời gian cho phép, bỏ qua
      if (time > timeLimit) continue;

      // Kiểm tra nếu ô hiện tại là ô an toàn và không phải vị trí đối thủ
      if (!bombRange[x][y] && grid[x][y] === 0 && !(x === opponentPosition[0] && y === opponentPosition[1])) {
          return path.concat([[x, y]]); // Trả về đường đi đến ô an toàn
      }

      // Duyệt qua các ô lân cận
      for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;

          if (
              nx >= 0 && nx < rows && ny >= 0 && ny < cols && // Trong lưới
              !visited[nx][ny] &&                             // Chưa thăm
              grid[nx][ny] !== 1 && grid[nx][ny] !== 5 && grid[nx][ny] !== 3 && grid[nx][ny] !== 2 &&    // Không phải ô chặn
              !(nx === opponentPosition[0] && ny === opponentPosition[1]) // Không phải vị trí đối thủ
          ) {
              visited[nx][ny] = true;
              queue.push([nx, ny, time + 1, path.concat([[x, y]])]);
          }
      }
  }

  return null; // Không tìm thấy ô an toàn trong thời gian giới hạn
}

function manhattanDistance(pos1, pos2) {
  const [x1, y1] = pos1;
  const [x2, y2] = pos2;
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function find_index_player(players)
{
  for (let i = 0; i < players.length; i++) {
    if (players[i]['id'] === playerId1)
    {
      return i
    }
  }
}

function find_index_opp(players)
{
  for (let i = 0; i < players.length; i++) {
    if (players[i]['id'] !== playerId1)
    {
      return i
    }
  }
}


