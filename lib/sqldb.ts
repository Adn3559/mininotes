// lib/sqldb.ts — VRAI moteur SQL en mémoire (labo). alasql = SQL en pur JS, zéro compilation.
import alasql from "alasql";
import bcrypt from "bcryptjs";

let prete = false;

export async function getDb() {
  if (!prete) {
    alasql("CREATE TABLE IF NOT EXISTS users (id INT, email STRING, password STRING, role STRING)");
    alasql("CREATE TABLE IF NOT EXISTS notes (id INT, userId INT, titre STRING, contenu STRING)");
    alasql("CREATE TABLE IF NOT EXISTS comments (id INT, author STRING, html STRING)");

    alasql("DELETE FROM users");
    alasql("DELETE FROM notes");
    alasql("DELETE FROM comments");

    // ✅ CORRECTIF : mots de passe HACHÉS avec bcrypt (jamais en clair)
    const hashAlice = await bcrypt.hash("azerty123", 10);
    const hashBob = await bcrypt.hash("motdepasse", 10);
    const hashAdmin = await bcrypt.hash("admin", 10);

    alasql("INSERT INTO users VALUES (?,?,?,?)", [1, "alice@mininotes.test", hashAlice, "user"]);
    alasql("INSERT INTO users VALUES (?,?,?,?)", [2, "bob@mininotes.test", hashBob, "user"]);
    alasql("INSERT INTO users VALUES (?,?,?,?)", [3, "admin@mininotes.test", hashAdmin, "admin"]);

    alasql("INSERT INTO notes VALUES (1,1,'Liste de courses','lait, pain, cafe')");
    alasql("INSERT INTO notes VALUES (2,2,'Idee projet','une appli de notes privees')");
    alasql("INSERT INTO notes VALUES (3,3,'Codes admin','le code du coffre est 4271')");

    alasql("INSERT INTO comments VALUES (1,'Alice','Super appli !')");
    alasql("INSERT INTO comments VALUES (2,'Attaquant','<img src=x onerror=alert(1)>Bonjour')");

    prete = true;
  }
  return alasql;
}