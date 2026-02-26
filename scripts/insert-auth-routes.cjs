const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'server', 'routes.ts');
const content = fs.readFileSync(filePath, 'utf8');

const searchLine = '// Authentication routes are handled in auth.ts';
const idx = content.indexOf(searchLine);

if (idx === -1) {
    console.error('ERROR: Could not find the target comment in routes.ts');
    // Let's search for something close
    const lines = content.split('\n');
    for (let i = 270; i < 285; i++) {
        console.log(`Line ${i + 1}: |${lines[i]}|`);
    }
    process.exit(1);
}

const replacement = `// ===== LOCAL AUTH ROUTES (Username/Password) =====
  // POST /api/login — authenticate with identifier (username or email) + password
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { identifier, password } = req.body;

      if (!identifier) {
        return res.status(400).json({ message: "Se requiere nombre de usuario o correo electr\\u00F3nico" });
      }
      if (!password) {
        return res.status(400).json({ message: "Se requiere contrase\\u00F1a" });
      }

      // Look up user by username OR email
      const user = await global.storage.getUserByIdentifier(identifier);

      if (!user || !user.password) {
        return res.status(401).json({ message: "Credenciales inv\\u00E1lidas" });
      }

      const isValid = await comparePasswords(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Credenciales inv\\u00E1lidas" });
      }

      // Log the user in via express-session / passport
      req.login(user, (err: any) => {
        if (err) {
          console.error("Login session error:", err);
          return res.status(500).json({ message: "Error al iniciar sesi\\u00F3n" });
        }

        const { password: _, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Error interno al iniciar sesi\\u00F3n" });
    }
  });

  // POST /api/register — create a new local account
  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      const { fullName, username, email, password } = req.body;

      if (!username || !password || !fullName) {
        return res.status(400).json({ message: "Nombre completo, usuario y contrase\\u00F1a son requeridos" });
      }

      const existingUser = await global.storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "El nombre de usuario ya existe" });
      }

      if (email) {
        const existingEmail = await global.storage.getUserByEmail(email);
        if (existingEmail) {
          return res.status(400).json({ message: "El correo electr\\u00F3nico ya est\\u00E1 registrado" });
        }
      }

      const hashedPw = await hashPassword(password);
      const newUser = await global.storage.createUser({
        fullName,
        username,
        email: email || null,
        password: hashedPw,
        isPrimary: false,
        role: 'content_creator',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      req.login(newUser, (err: any) => {
        if (err) {
          console.error("Register session error:", err);
          return res.status(500).json({ message: "Error al registrar sesi\\u00F3n" });
        }
        const { password: _, ...userWithoutPassword } = newUser;
        return res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Error interno al registrar usuario" });
    }
  });

  // POST /api/logout — destroy session
  app.post("/api/logout", (req: Request, res: Response) => {
    req.logout((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Error al cerrar sesi\\u00F3n" });
      }
      res.sendStatus(200);
    });
  });`;

const newContent = content.replace(searchLine, replacement);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('SUCCESS: Auth routes inserted into routes.ts');
