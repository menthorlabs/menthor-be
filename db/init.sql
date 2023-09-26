--
-- Table structure for table `Course`
--

DROP TABLE IF EXISTS `Course`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Course` (
  `Id` varchar(38) NOT NULL,
  `ContentId` varchar(255) NOT NULL,
  `Done` tinyint NOT NULL DEFAULT '0',
  `User_Id` varchar(45) NOT NULL COMMENT 'User ID is the user email',
  `TimeTrack` int unsigned NOT NULL DEFAULT '0',
  `UpdatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Lessons` json DEFAULT NULL,
  `CurrentLessonId` varchar(255) DEFAULT NULL,
  `EnrollStatus` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `Duplicated_IDX` (`ContentId`,`User_Id`) /*!80000 INVISIBLE */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Lesson`
--

DROP TABLE IF EXISTS `Lesson`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Lesson` (
  `Id` varchar(255) NOT NULL,
  `Progress` float NOT NULL,
  `TimeTrack` int NOT NULL DEFAULT '0',
  `ContentUrl` varchar(2083) DEFAULT NULL,
  `Done` tinyint NOT NULL DEFAULT '0',
  `User_Id` varchar(100) NOT NULL COMMENT 'User ID is the user email',
  `Course_Id` varchar(255) NOT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='		';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Roadmap`
--

DROP TABLE IF EXISTS `Roadmap`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Roadmap` (
  `Id` varchar(38) NOT NULL,
  `Name` varchar(100) NOT NULL,
  `Description` text NOT NULL,
  `ImageUrl` varchar(2083) NOT NULL,
  `Private` tinyint NOT NULL DEFAULT '0',
  `Active` tinyint NOT NULL DEFAULT '1',
  `Courses` json NOT NULL,
  `Owner` varchar(45) DEFAULT NULL COMMENT 'User ID is the user email',
  `Tags` json DEFAULT NULL,
  PRIMARY KEY (`Id`),
  FULLTEXT KEY `Roadmap_Fulltext_index` (`Name`,`Description`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Submission`
--

DROP TABLE IF EXISTS `Submission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Submission` (
  `Id` varchar(38) NOT NULL,
  `Content` text,
  `Proeficiency` float DEFAULT NULL,
  `SubmissionType` enum('Image','Content') NOT NULL,
  `SubmissionStatus` enum('Approved','Rejected','Pending','Draft','ChangesRequested') NOT NULL,
  `Reviewers` json DEFAULT NULL,
  `LessonUrl` varchar(2083) NOT NULL,
  `User_Id` varchar(38) NOT NULL COMMENT 'User ID is the user email',
  `CreatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Lesson_Id` varchar(255) NOT NULL,
  `Filename` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `Submitter_Id_idx` (`User_Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `User`
--

DROP TABLE IF EXISTS `User`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `User` (
  `Id` varchar(100) NOT NULL,
  `Name` varchar(100) NOT NULL,
  `Username` varchar(45) DEFAULT NULL,
  `Email` varchar(120) NOT NULL,
  `ImageUrl` varchar(2083) DEFAULT NULL,
  `Tags` json DEFAULT NULL,
  `Ranks` json DEFAULT NULL,
  `Badges` json DEFAULT NULL,
  `Data` json DEFAULT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `Email_UNIQUE` (`Email`),
  KEY `Email_Text_Search` (`Email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
